const User = require("./user.model");
const UserProfile = require("./userProfile.model");
const UserReferral = require("./userReferral.model");
const Setting = require("../admin/setting.model");
const WheelPrize = require("../rewards/wheelPrize.model");
const ScratchPrize = require("../rewards/scratchPrize.model");
const ShufflePrize = require("../rewards/shufflePrize.model");
const { grantReward } = require("../rewards/userReward.service");
const {
    formatUserReferral,
    formatReferralSummary,
} = require("./userReferral.mapper");
const { ensureUserReferralCode } = require("../../utils/generateReferralCode");
const ApiError = require("../../utils/ApiError");

const SETTING_KEY = "USER_REFERRAL";

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

const PRIZE_MODELS = {
    WHEEL: WheelPrize,
    SCRATCH: ScratchPrize,
    SHUFFLE: ShufflePrize,
};

const getPrizeModel = (gameType) => {
    const model = PRIZE_MODELS[String(gameType || "").toUpperCase()];
    if (!model) {
        throw new ApiError(400, "gameType must be WHEEL, SCRATCH or SHUFFLE");
    }
    return model;
};

exports.getReferralSetting = async () => {
    const setting = await Setting.findOne({ key: SETTING_KEY });
    if (!setting) {
        return { ...DEFAULT_SETTING };
    }
    return {
        ...DEFAULT_SETTING,
        ...setting.value,
        referrerReward: {
            ...DEFAULT_SETTING.referrerReward,
            ...(setting.value?.referrerReward || {}),
        },
        refereeReward: {
            ...DEFAULT_SETTING.refereeReward,
            ...(setting.value?.refereeReward || {}),
        },
    };
};

exports.updateReferralSetting = async (body) => {
    const current = await exports.getReferralSetting();

    const next = {
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled,
        referrerReward: {
            enabled:
                body.referrerReward?.enabled !== undefined
                    ? Boolean(body.referrerReward.enabled)
                    : current.referrerReward.enabled,
            gameType: String(
                body.referrerReward?.gameType || current.referrerReward.gameType
            ).toUpperCase(),
            prizeId:
                body.referrerReward?.prizeId !== undefined
                    ? body.referrerReward.prizeId || null
                    : current.referrerReward.prizeId,
        },
        refereeReward: {
            enabled:
                body.refereeReward?.enabled !== undefined
                    ? Boolean(body.refereeReward.enabled)
                    : current.refereeReward.enabled,
            gameType: String(
                body.refereeReward?.gameType || current.refereeReward.gameType
            ).toUpperCase(),
            prizeId:
                body.refereeReward?.prizeId !== undefined
                    ? body.refereeReward.prizeId || null
                    : current.refereeReward.prizeId,
        },
    };

    for (const side of ["referrerReward", "refereeReward"]) {
        const cfg = next[side];
        if (!["WHEEL", "SCRATCH", "SHUFFLE"].includes(cfg.gameType)) {
            throw new ApiError(400, `${side}.gameType must be WHEEL, SCRATCH or SHUFFLE`);
        }
        if (cfg.enabled && cfg.prizeId) {
            const prize = await getPrizeModel(cfg.gameType).findById(cfg.prizeId);
            if (!prize || prize.status !== "ACTIVE") {
                throw new ApiError(
                    400,
                    `${side}: selected prize not found or inactive`
                );
            }
        }
    }

    await Setting.findOneAndUpdate(
        { key: SETTING_KEY },
        {
            key: SETTING_KEY,
            value: next,
            description:
                "User-to-user referral rewards (spin / scratch / shuffle)",
        },
        { upsert: true, new: true }
    );

    return next;
};

const resolvePrize = async (cfg) => {
    if (!cfg?.enabled || !cfg.prizeId) return null;
    const prize = await getPrizeModel(cfg.gameType).findById(cfg.prizeId);
    if (!prize || prize.status !== "ACTIVE") return null;
    return { gameType: cfg.gameType, prize };
};

const grantConfiguredRewards = async (referrerId, refereeId, setting) => {
    let referrerRewardId = null;
    let refereeRewardId = null;

    if (!setting.enabled) {
        return { referrerRewardId, refereeRewardId };
    }

    const referrerPrize = await resolvePrize(setting.referrerReward);
    if (referrerPrize) {
        const reward = await grantReward({
            userId: referrerId,
            gameType: referrerPrize.gameType,
            prize: referrerPrize.prize,
        });
        referrerRewardId = reward.id;
    }

    const refereePrize = await resolvePrize(setting.refereeReward);
    if (refereePrize) {
        const reward = await grantReward({
            userId: refereeId,
            gameType: refereePrize.gameType,
            prize: refereePrize.prize,
        });
        refereeRewardId = reward.id;
    }

    return { referrerRewardId, refereeRewardId };
};

/** Used by user referral AND partner referral signup. */
exports.applyReferralRewards = async (referrerUserId, refereeUserId) => {
    const setting = await exports.getReferralSetting();
    return grantConfiguredRewards(referrerUserId, refereeUserId, setting);
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

    const setting = await exports.getReferralSetting();
    const { referrerRewardId, refereeRewardId } =
        await grantConfiguredRewards(referrer._id, newUserId, setting);

    await UserReferral.create({
        referrer: referrer._id,
        referredUser: newUserId,
        referralCode: code,
        status: "REGISTERED",
        referrerRewardId,
        refereeRewardId,
    });

    const notificationService = require("../notification/notification.service");
    if (referrerRewardId) {
        await notificationService.create(referrer._id, {
            title: "Referral Reward",
            message: "You earned a reward for referring a new user",
            type: "SUCCESS",
        });
    }
    if (refereeRewardId) {
        await notificationService.create(newUserId, {
            title: "Welcome Reward",
            message: "You received a signup referral reward",
            type: "SUCCESS",
        });
    }

    return referrer;
};

exports.getMyReferralInfo = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const referralCode = await ensureUserReferralCode(user);
    const referralCount = await UserReferral.countDocuments({
        referrer: userId,
    });

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
        referredBy,
    });
};

exports.getMyReferrals = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
        UserReferral.find({ referrer: userId })
            .populate("referredUser", "mobile email status")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        UserReferral.countDocuments({ referrer: userId }),
    ]);

    const userIds = records
        .map((r) => r.referredUser?._id || r.referredUser)
        .filter(Boolean);

    const profiles = await UserProfile.find({ user: { $in: userIds } });
    const profileMap = Object.fromEntries(
        profiles.map((p) => [p.user.toString(), p])
    );

    return {
        referrals: records.map((item) => {
            const uid = (
                item.referredUser?._id || item.referredUser
            )?.toString();
            return formatUserReferral(item, profileMap[uid]);
        }),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/** Admin: recent referrals — USER (USR) + PARTNER (PRT) */
exports.getAdminReferrals = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const sourceFilter = String(query.source || "").toUpperCase(); // USER | PARTNER | ""

    // Ensure models are registered before populate
    require("../partner/partner.model");
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
