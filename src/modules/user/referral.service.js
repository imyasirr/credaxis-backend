const User = require("./model");
const UserProfile = require("./profile.model");
const UserReferral = require("./referral.model");
const {
    formatUserReferral,
    formatPartnerOwnedReferral,
    formatReferralSummary,
} = require("./referral.mapper");
const { ensureUserReferralCode } = require("../../utils/generateReferralCode");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");

const DEFAULT_SETTING = {
    enabled: false,
    referrerReward: {
        enabled: false,
        gameType: "WHEEL",
        prizeId: null,
    },
    refereeReward: {
        enabled: false,
        gameType: "SCRATCH",
        prizeId: null,
    },
};

exports.getReferralSetting = async () => {
    // Legacy settings kept for API compatibility — rewards now come only from Reward Management rules.
    return {
        ...DEFAULT_SETTING,
        enabled: false,
        deprecated: true,
        message:
            "Referral rewards are managed in Reward Management (REFERRAL_REFERRER / REFERRAL_REFEREE rules).",
    };
};

exports.updateReferralSetting = async () => {
    throw new ApiError(
        400,
        "User referral settings are deprecated. Configure REFERRAL_REFERRER and REFERRAL_REFEREE rules in Reward Management instead."
    );
};

/**
 * Used by user referral AND partner referral signup.
 * Grants only via Reward Management rules (REFERRAL_REFERRER / REFERRAL_REFEREE).
 * Legacy USER_REFERRAL settings are no longer applied (avoids double rewards).
 */
exports.applyReferralRewards = async (referrerUserId, refereeUserId) => {
    const rewardRuleService = require("../rewards/rewardRule.service");
    const [referrerRules, refereeRules] = await Promise.all([
        rewardRuleService.applyTrigger("REFERRAL_REFERRER", referrerUserId),
        rewardRuleService.applyTrigger("REFERRAL_REFEREE", refereeUserId),
    ]);

    return {
        referrerRewardId: referrerRules[0]?.id || null,
        refereeRewardId: refereeRules[0]?.id || null,
        ruleRewards: {
            referrer: referrerRules,
            referee: refereeRules,
        },
    };
};

exports.validateReferralCode = async (code) => {
    const referrer = await User.findOne({
        referralCode: String(code).toUpperCase().trim(),
        isDeleted: false,
        status: "ACTIVE",
    });

    if (!referrer) {
        throw new ApiError(404, "Invalid or inactive referral code");
    }

    const profile = await UserProfile.findOne({ user: referrer._id });

    return {
        valid: true,
        referralCode: referrer.referralCode,
        referrer: {
            id: referrer._id,
            mobile: referrer.mobile,
            fullName: profile
                ? [profile.firstName, profile.lastName].filter(Boolean).join(" ")
                : "",
        },
        message: "Valid user referral code",
    };
};

/**
 * Link new user under an existing user's referral code.
 * Creates UserReferral + optional rewards from admin settings.
 */
exports.linkUserReferral = async (referralCode, newUserId) => {
    const code = String(referralCode).toUpperCase().trim();
    const referrer = await User.findOne({
        referralCode: code,
        isDeleted: false,
        status: "ACTIVE",
    });

    if (!referrer) {
        return null;
    }

    if (referrer._id.toString() === newUserId.toString()) {
        return null;
    }

    const newUser = await User.findById(newUserId);
    if (!newUser) {
        return null;
    }

    const existing = await UserReferral.findOne({ referredUser: newUserId });
    if (existing || newUser.referredBy) {
        return referrer;
    }

    newUser.referredBy = referrer._id;
    await newUser.save();

    // Settings prizes removed — only Reward Management rules (REFERRAL_*)
    const granted = await exports.applyReferralRewards(
        referrer._id,
        newUserId
    );
    const { referrerRewardId, refereeRewardId } = granted;

    await UserReferral.create({
        referrer: referrer._id,
        referredUser: newUserId,
        referralCode: code,
        status: "REGISTERED",
        referrerRewardId,
        refereeRewardId,
    });

    const notificationService = require("../notification/service");
    if (referrerRewardId || granted.ruleRewards?.referrer?.length) {
        await notificationService.create(referrer._id, {
            title: "Referral Reward",
            message: "You earned a reward for referring a new user",
            type: "SUCCESS",
        });
    }
    if (refereeRewardId || granted.ruleRewards?.referee?.length) {
        await notificationService.create(newUserId, {
            title: "Welcome Reward",
            message: "You received a signup referral reward",
            type: "SUCCESS",
        });
    }

    return referrer;
};

exports.getMyReferralInfo = async (userId, roleName = null) => {
    const user = await User.findById(userId).populate("role", "name");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const role =
        roleName ||
        (typeof user.role === "object" && user.role?.name
            ? user.role.name
            : null) ||
        ROLES.USER;

    const referralCode = await ensureUserReferralCode(user);
    const referralCount = await UserReferral.countDocuments({
        referrer: userId,
    });

    let partnerCode = null;
    let partnerReferralCount = 0;

    const { getPartnerAccess } = require("../partner/access");
    const partnerAccess = await getPartnerAccess(userId);
    const isPartner =
        partnerAccess.isApproved || role === ROLES.PARTNER;

    if (isPartner) {
        partnerCode = partnerAccess.partnerCode;
        if (partnerAccess.isApproved) {
            const PartnerReferral = require("../partner/referral.model");
            partnerReferralCount = await PartnerReferral.countDocuments({
                partnerUser: userId,
            });
        }
    }

    let referredBy = null;
    if (user.referredBy) {
        const parent = await User.findById(user.referredBy).select(
            "mobile referralCode"
        );
        const parentProfile = await UserProfile.findOne({
            user: user.referredBy,
        });
        if (parent) {
            referredBy = {
                id: parent._id,
                mobile: parent.mobile,
                referralCode: parent.referralCode || null,
                fullName: parentProfile
                    ? [parentProfile.firstName, parentProfile.lastName]
                          .filter(Boolean)
                          .join(" ")
                    : "",
            };
        }
    }

    return formatReferralSummary({
        referralCode,
        referralCount,
        partnerCode,
        partnerReferralCount,
        referredBy,
    });
};

/**
 * Unified referrals list for the logged-in caller.
 * - USER → personal USR referrals
 * - PARTNER → personal USR referrals + PRT partner referrals
 * Optional query.source = USER | PARTNER
 */
exports.getMyReferrals = async (userId, query = {}, roleName = null) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;
    const sourceFilter = String(query.source || "").toUpperCase();

    let role = roleName;
    if (!role) {
        const user = await User.findById(userId).populate("role", "name");
        role =
            typeof user?.role === "object" && user.role?.name
                ? user.role.name
                : ROLES.USER;
    }

    const { getPartnerAccess } = require("../partner/access");
    const partnerAccess = await getPartnerAccess(userId);
    const isApprovedPartner =
        partnerAccess.isApproved || role === ROLES.PARTNER;

    const includeUser = sourceFilter !== "PARTNER";
    const includePartner = isApprovedPartner && sourceFilter !== "USER";

    const fetchSize = Math.max(skip + limit, limit);

    let userRecords = [];
    let partnerRecords = [];
    let userTotal = 0;
    let partnerTotal = 0;

    if (includeUser) {
        [userRecords, userTotal] = await Promise.all([
            UserReferral.find({ referrer: userId })
                .populate("referredUser", "mobile email status")
                .sort({ createdAt: -1 })
                .limit(fetchSize),
            UserReferral.countDocuments({ referrer: userId }),
        ]);
    }

    if (includePartner) {
        const PartnerReferral = require("../partner/referral.model");
        [partnerRecords, partnerTotal] = await Promise.all([
            PartnerReferral.find({ partnerUser: userId })
                .populate("referredUser", "mobile email status")
                .sort({ createdAt: -1 })
                .limit(fetchSize),
            PartnerReferral.countDocuments({ partnerUser: userId }),
        ]);
    }

    const referredIds = [
        ...userRecords,
        ...partnerRecords,
    ]
        .map((r) => r.referredUser?._id || r.referredUser)
        .filter(Boolean);

    const profiles = await UserProfile.find({ user: { $in: referredIds } });
    const profileMap = Object.fromEntries(
        profiles.map((p) => [p.user.toString(), p])
    );

    const userMapped = userRecords.map((item) => {
        const uid = (item.referredUser?._id || item.referredUser)?.toString();
        return formatUserReferral(item, profileMap[uid]);
    });

    const partnerMapped = partnerRecords.map((item) => {
        const uid = (item.referredUser?._id || item.referredUser)?.toString();
        return formatPartnerOwnedReferral(item, profileMap[uid]);
    });

    const merged = [...userMapped, ...partnerMapped].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const total = userTotal + partnerTotal;
    const referrals = merged.slice(skip, skip + limit);

    const result = {
        role,
        isApprovedPartner,
        referrals,
        counts: {
            user: userTotal,
            partner: partnerTotal,
            total,
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };

    if (partnerAccess.partnerCode) {
        result.partnerCode = partnerAccess.partnerCode;
    }

    return result;
};

/** Admin: recent referrals — USER (USR) + PARTNER (PRT) */
exports.getAdminReferrals = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const sourceFilter = String(query.source || "").toUpperCase(); // USER | PARTNER | ""

    // Ensure models are registered before populate
    require("../partner/model");
    const PartnerReferral = require("../partner/referral.model");

    const userFilter = {};
    const partnerFilter = {};
    if (query.status) {
        userFilter.status = query.status;
        partnerFilter.status = query.status;
    }
    if (query.referrerId) {
        userFilter.referrer = query.referrerId;
        partnerFilter.partnerUser = query.referrerId;
    }

    const fetchSize = Math.max(skip + limit, limit);

    let userRecords = [];
    let partnerRecords = [];
    let userTotal = 0;
    let partnerTotal = 0;

    if (sourceFilter !== "PARTNER") {
        [userRecords, userTotal] = await Promise.all([
            UserReferral.find(userFilter)
                .populate("referrer", "mobile email")
                .populate("referredUser", "mobile email")
                .sort({ createdAt: -1 })
                .limit(fetchSize),
            UserReferral.countDocuments(userFilter),
        ]);
    }

    if (sourceFilter !== "USER") {
        try {
            [partnerRecords, partnerTotal] = await Promise.all([
                PartnerReferral.find(partnerFilter)
                    .populate("partnerUser", "mobile email")
                    .populate("referredUser", "mobile email")
                    .populate("partner", "businessName partnerCode")
                    .sort({ createdAt: -1 })
                    .limit(fetchSize),
                PartnerReferral.countDocuments(partnerFilter),
            ]);
        } catch (err) {
            // Fallback without partner populate if model/ref issues
            console.error("Partner referrals populate failed:", err.message);
            [partnerRecords, partnerTotal] = await Promise.all([
                PartnerReferral.find(partnerFilter)
                    .populate("partnerUser", "mobile email")
                    .populate("referredUser", "mobile email")
                    .sort({ createdAt: -1 })
                    .limit(fetchSize),
                PartnerReferral.countDocuments(partnerFilter),
            ]);
        }
    }

    const userMapped = userRecords.map((item) => ({
        id: item._id,
        source: "USER",
        referralCode: item.referralCode,
        status: item.status,
        referrer: item.referrer
            ? {
                  id: item.referrer._id,
                  mobile: item.referrer.mobile,
                  email: item.referrer.email || "",
              }
            : null,
        referredUser: item.referredUser
            ? {
                  id: item.referredUser._id,
                  mobile: item.referredUser.mobile,
                  email: item.referredUser.email || "",
              }
            : null,
        referrerRewardId: item.referrerRewardId || null,
        refereeRewardId: item.refereeRewardId || null,
        createdAt: item.createdAt,
    }));

    const partnerMapped = partnerRecords.map((item) => ({
        id: item._id,
        source: "PARTNER",
        referralCode: item.partnerCode,
        status: item.status,
        referrer: item.partnerUser
            ? {
                  id: item.partnerUser._id,
                  mobile: item.partnerUser.mobile,
                  email: item.partnerUser.email || "",
                  businessName: item.partner?.businessName || "",
              }
            : null,
        referredUser: item.referredUser
            ? {
                  id: item.referredUser._id,
                  mobile: item.referredUser.mobile,
                  email: item.referredUser.email || "",
              }
            : null,
        referrerRewardId: null,
        refereeRewardId: null,
        createdAt: item.createdAt,
    }));

    const merged = [...userMapped, ...partnerMapped].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const total = userTotal + partnerTotal;
    const referrals = merged.slice(skip, skip + limit);

    return {
        referrals,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};
