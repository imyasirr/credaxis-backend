const partnerRepository = require("./partner.repository");
const referralRepository = require("./referral.repository");
const userRepository = require("../user/user.repository");
const roleRepository = require("../role/role.repository");
const notificationService = require("../notification/notification.service");
const UserProfile = require("../user/userProfile.model");

const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");
const {
    formatPartner,
    formatReferralRecord,
    formatRegistrationStatus,
} = require("./partner.mapper");
const { getUploadPath } = require("../../middleware/upload.middleware");
const Kyc = require("../kyc/kyc.model");
const { formatKycSummary } = require("../kyc/kyc.mapper");

const getFilePath = (files, field) => {
    const file = files?.[field]?.[0];
    return file ? getUploadPath("partner", file.filename) : null;
};

const buildPartnerData = (body, files) => ({
    businessName: body.businessName?.trim(),
    businessType: body.businessType?.trim().toUpperCase(),
    ownerName: body.ownerName?.trim(),
    email: body.email?.trim().toLowerCase() || "",
    gstNumber: body.gstNumber?.trim().toUpperCase() || "",
    panNumber: body.panNumber?.trim().toUpperCase(),
    address: body.address?.trim(),
    city: body.city?.trim(),
    state: body.state?.trim(),
    pincode: body.pincode?.trim(),
    country: body.country?.trim() || "India",
    shopPhoto: getFilePath(files, "shopPhoto"),
    gstDocument: getFilePath(files, "gstDocument"),
    panDocument: getFilePath(files, "panDocument"),
});

const generatePartnerCode = async () => {
    let code;
    let exists = true;

    while (exists) {
        code =
            "PRT" +
            Math.random().toString(36).substring(2, 8).toUpperCase();
        exists = await partnerRepository.findOne({ partnerCode: code });
    }

    return code;
};

const getProfileMap = async (userIds) => {
    const profiles = await UserProfile.find({ user: { $in: userIds } });

    return Object.fromEntries(profiles.map((p) => [p.user.toString(), p]));
};

/** Attach identity KYC (user KYC) onto partner DTOs */
const attachKycToPartners = async (partners) => {
    const list = Array.isArray(partners) ? partners : [partners];
    const userIds = list
        .map((p) => p?.userId)
        .filter(Boolean)
        .map((id) => id.toString());

    if (!userIds.length) {
        return Array.isArray(partners)
            ? partners.map((p) => ({
                  ...p,
                  kyc: formatKycSummary(null),
                  kycStatus: "NOT_SUBMITTED",
              }))
            : {
                  ...partners,
                  kyc: formatKycSummary(null),
                  kycStatus: "NOT_SUBMITTED",
              };
    }

    const kycRecords = await Kyc.find({ user: { $in: userIds } });
    const kycMap = Object.fromEntries(
        kycRecords.map((k) => [k.user.toString(), k])
    );

    const enrich = (partner) => {
        const kyc = kycMap[partner.userId?.toString()];
        const summary = formatKycSummary(kyc || null);
        return {
            ...partner,
            kyc: summary,
            kycStatus: summary.status,
        };
    };

    return Array.isArray(partners) ? list.map(enrich) : enrich(partners);
};

const getApprovedPartner = async (userId) => {
    const partner = await partnerRepository.findByUserId(userId);

    if (!partner || partner.status !== "APPROVED") {
        throw new ApiError(403, "Approved partner access only");
    }

    return partner;
};

exports.getRegistrationStatus = async (userId) => {
    const user = await userRepository.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const role = await roleRepository.findById(user.role);
    const partner = await partnerRepository.findByUserId(userId);

    if (role?.name === ROLES.PARTNER && partner?.status === "APPROVED") {
        return formatRegistrationStatus({
            step: "APPROVED",
            canApply: false,
            canUpdate: false,
            nextAction: "open_dashboard",
            message: "You are an approved partner",
            application: await attachKycToPartners(formatPartner(partner)),
        });
    }

    if (!partner) {
        return formatRegistrationStatus({
            step: "APPLY",
            canApply: true,
            canUpdate: false,
            nextAction: "submit_application",
            message: "Submit partner application to get started",
            application: null,
        });
    }

    if (partner.status === "PENDING") {
        return formatRegistrationStatus({
            step: "PENDING",
            canApply: false,
            canUpdate: true,
            nextAction: "wait_for_approval",
            message: "Your application is under admin review",
            application: await attachKycToPartners(formatPartner(partner)),
        });
    }

    if (partner.status === "REJECTED") {
        return formatRegistrationStatus({
            step: "REJECTED",
            canApply: true,
            canUpdate: true,
            nextAction: "resubmit",
            message: partner.remarks || "Application rejected. You can re-apply",
            application: await attachKycToPartners(formatPartner(partner)),
        });
    }

    return formatRegistrationStatus({
        step: partner.status,
        canApply: false,
        canUpdate: false,
        nextAction: "open_dashboard",
        message: "Partner application status fetched",
        application: await attachKycToPartners(formatPartner(partner)),
    });
};

exports.validatePartnerCode = async (code) => {
    const partner = await partnerRepository.findByPartnerCode(code);

    if (!partner) {
        throw new ApiError(404, "Invalid or inactive partner code");
    }

    const { canEarnReferral } = require("../../constants/userStatusPolicy");
    const partnerUser = await userRepository.findById(partner.user);

    if (
        !partnerUser ||
        partnerUser.isDeleted ||
        !canEarnReferral(partnerUser.status)
    ) {
        throw new ApiError(404, "Invalid or inactive partner code");
    }

    return {
        valid: true,
        partnerCode: partner.partnerCode,
        businessName: partner.businessName,
        ownerName: partner.ownerName,
        message: "Valid partner referral code",
    };
};

exports.apply = async (userId, body, files) => {
    const user = await userRepository.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const role = await roleRepository.findById(user.role);

    if (role?.name === ROLES.PARTNER) {
        throw new ApiError(400, "You are already a partner");
    }

    const existing = await partnerRepository.findByUserId(userId);

    if (existing?.status === "PENDING") {
        throw new ApiError(400, "Partner application already pending review");
    }

    if (existing?.status === "APPROVED") {
        throw new ApiError(400, "You are already an approved partner");
    }

    const data = buildPartnerData(body, files);

    if (!data.shopPhoto || !data.panDocument) {
        throw new ApiError(
            400,
            "Shop photo and PAN document are required. Send multipart/form-data with fields: shopPhoto, panDocument (gstDocument optional)"
        );
    }

    data.status = "PENDING";
    data.remarks = "";
    data.approvedBy = null;
    data.approvedAt = null;

    let partner;

    if (existing?.status === "REJECTED") {
        partner = await partnerRepository.update(existing._id, data);
    } else {
        partner = await partnerRepository.create({
            user: userId,
            ...data,
        });
    }

    await notificationService.create(userId, {
        title: "Partner Application Submitted",
        message: "Your partner application is under review",
        type: "INFO",
    });

    return {
        ...formatPartner(partner),
        registration: await exports.getRegistrationStatus(userId),
    };
};

exports.getMyPartner = async (userId) => {
    const partner = await partnerRepository.findByUserId(userId);

    if (!partner) {
        return {
            status: "NOT_APPLIED",
            message: "Partner application not submitted yet",
        };
    }

    return attachKycToPartners(formatPartner(partner));
};

exports.getMyKyc = async (userId) => {
    const kycService = require("../kyc/kyc.service");
    return kycService.getMyKyc(userId);
};

exports.submitKyc = async (userId, body, files) => {
    const kycService = require("../kyc/kyc.service");
    return kycService.submitKyc(userId, body, files);
};

exports.updateApplication = async (userId, body, files) => {
    const partner = await partnerRepository.findByUserId(userId);

    if (!partner) {
        throw new ApiError(404, "Partner application not found");
    }

    if (!["PENDING", "REJECTED"].includes(partner.status)) {
        throw new ApiError(400, "Only pending or rejected applications can be updated");
    }

    const data = buildPartnerData(body, files);

    if (files?.shopPhoto?.[0] === undefined) data.shopPhoto = partner.shopPhoto;
    if (files?.gstDocument?.[0] === undefined) data.gstDocument = partner.gstDocument;
    if (files?.panDocument?.[0] === undefined) data.panDocument = partner.panDocument;

    if (partner.status === "REJECTED") {
        data.status = "PENDING";
        data.remarks = "";
    }

    const updated = await partnerRepository.update(partner._id, data);

    return {
        ...formatPartner(updated),
        registration: await exports.getRegistrationStatus(userId),
    };
};

exports.getReferralLink = async (userId) => {
    const partner = await getApprovedPartner(userId);

    return {
        partnerCode: partner.partnerCode,
        businessName: partner.businessName,
        shareMessage: `Join CredAxis using my partner code ${partner.partnerCode}`,
        instructions:
            "New users should enter this code while verifying OTP during signup",
    };
};

exports.getReferralStats = async (userId) => {
    const partner = await getApprovedPartner(userId);

    const [totalReferrals, activeReferrals] = await Promise.all([
        referralRepository.countByPartnerUserId(userId),
        referralRepository.countByPartnerUserIdAndStatus(userId, "ACTIVE"),
    ]);

    return {
        partnerCode: partner.partnerCode,
        commissionRate: partner.commissionRate,
        totalReferrals,
        activeReferrals,
        registeredReferrals: totalReferrals - activeReferrals,
        totalEarnings: partner.totalEarnings,
        pendingRewards: 0,
        rewardStatus: "Rewards will be enabled soon",
    };
};

exports.getDashboard = async (userId) => {
    const partner = await getApprovedPartner(userId);
    const tokenTransferService = require("../creditToken/tokenTransfer.service");

    const recentRecords = await referralRepository.findByPartnerUserId(userId, {
        skip: 0,
        limit: 5,
    });

    const userIds = recentRecords
        .map((item) => item.referredUser?._id || item.referredUser)
        .filter(Boolean);

    const profileMap = await getProfileMap(userIds);

    const [tokenBalances, tokenTransferData] = await Promise.all([
        tokenTransferService.getPartnerBalancesByUser(userId),
        tokenTransferService.getTransfers({
            partnerUserId: userId,
            page: 1,
            limit: 5,
        }),
    ]);

    return {
        partner: formatPartner(partner),
        stats: {
            totalReferrals: partner.totalReferrals,
            totalEarnings: partner.totalEarnings,
            commissionRate: partner.commissionRate,
            partnerCode: partner.partnerCode,
        },
        tokenBalances,
        recentTokenTransfers: tokenTransferData.transfers,
        recentReferrals: recentRecords.map((item) => {
            const referredUserId = (
                item.referredUser?._id || item.referredUser
            ).toString();

            return formatReferralRecord(
                item,
                profileMap[referredUserId] || null
            );
        }),
    };
};

exports.getReferrals = async (userId, query) => {
    const partner = await getApprovedPartner(userId);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
        referralRepository.findByPartnerUserId(userId, { skip, limit }),
        referralRepository.countByPartnerUserId(userId),
    ]);

    const userIds = records
        .map((item) => item.referredUser?._id || item.referredUser)
        .filter(Boolean);

    const profileMap = await getProfileMap(userIds);

    return {
        partnerCode: partner.partnerCode,
        referrals: records.map((item) => {
            const referredUserId = (
                item.referredUser?._id || item.referredUser
            ).toString();

            return formatReferralRecord(
                item,
                profileMap[referredUserId] || null
            );
        }),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getApplications = async (status) => {
    const list = await partnerRepository.findByStatus(status);
    return attachKycToPartners(list.map(formatPartner));
};

exports.getAllPartners = async () => {
    const list = await partnerRepository.findByStatus(null);
    return attachKycToPartners(
        list.filter((p) => p.status === "APPROVED").map(formatPartner)
    );
};

exports.getMyTokenBalances = async (userId) => {
    await getApprovedPartner(userId);
    const tokenTransferService = require("../creditToken/tokenTransfer.service");
    return tokenTransferService.getPartnerBalancesByUser(userId);
};

exports.getMyTokenTransfers = async (userId, query = {}) => {
    await getApprovedPartner(userId);
    const tokenTransferService = require("../creditToken/tokenTransfer.service");
    return tokenTransferService.getTransfers({
        ...query,
        partnerUserId: userId,
    });
};

exports.getTokenPlans = async (userId, query = {}) => {
    await getApprovedPartner(userId);
    const tokenPurchaseService = require("../creditToken/tokenPurchase.service");
    return tokenPurchaseService.getActivePlans(query);
};

exports.purchaseTokens = async (userId, body) => {
    await getApprovedPartner(userId);
    const tokenPurchaseService = require("../creditToken/tokenPurchase.service");
    return tokenPurchaseService.purchaseTokens(userId, body);
};

exports.getMyTokenPurchases = async (userId, query = {}) => {
    await getApprovedPartner(userId);
    const tokenPurchaseService = require("../creditToken/tokenPurchase.service");
    return tokenPurchaseService.getUserPurchases(userId, query);
};

exports.getMyTokenPurchaseById = async (userId, purchaseId) => {
    await getApprovedPartner(userId);
    const tokenPurchaseService = require("../creditToken/tokenPurchase.service");
    return tokenPurchaseService.getPurchaseById(userId, purchaseId);
};

exports.verifyOnlinePayment = async (userId, purchaseId, payload) => {
    await getApprovedPartner(userId);
    const tokenPurchaseService = require("../creditToken/tokenPurchase.service");
    return tokenPurchaseService.verifyOnlinePayment(
        userId,
        purchaseId,
        payload
    );
};

exports.approve = async (partnerId, adminId, commissionRate) => {
    const partner = await partnerRepository.findById(partnerId);

    if (!partner) {
        throw new ApiError(404, "Partner application not found");
    }

    if (partner.status === "APPROVED") {
        throw new ApiError(400, "Partner already approved");
    }

    const partnerRole = await roleRepository.getPartnerRole();

    if (!partnerRole) {
        throw new ApiError(500, "Partner role not found");
    }

    const partnerCode = await generatePartnerCode();

    partner.status = "APPROVED";
    partner.partnerCode = partnerCode;
    partner.commissionRate = commissionRate || partner.commissionRate;
    partner.approvedBy = adminId;
    partner.approvedAt = new Date();
    partner.remarks = "";
    await partner.save();

    // Keep user's personal USR referralCode; partner invite uses Partner.partnerCode
    await userRepository.update(partner.user, {
        role: partnerRole._id,
    });

    await notificationService.create(partner.user, {
        title: "Partner Approved",
        message: `Congratulations! Your partner code is ${partnerCode}`,
        type: "SUCCESS",
    });

    return formatPartner(partner);
};

exports.reject = async (partnerId, adminId, remarks) => {
    const partner = await partnerRepository.findById(partnerId);

    if (!partner) {
        throw new ApiError(404, "Partner application not found");
    }

    if (partner.status === "APPROVED") {
        throw new ApiError(400, "Approved partner cannot be rejected");
    }

    partner.status = "REJECTED";
    partner.remarks = remarks;
    partner.approvedBy = adminId;
    partner.approvedAt = new Date();
    await partner.save();

    await notificationService.create(partner.user, {
        title: "Partner Application Rejected",
        message: remarks || "Your partner application was rejected",
        type: "ERROR",
    });

    return formatPartner(partner);
};

exports.linkReferral = async (partnerCode, newUserId) => {
    const partner = await partnerRepository.findByPartnerCode(partnerCode);

    if (!partner) {
        return null;
    }

    const { canEarnReferral } = require("../../constants/userStatusPolicy");
    const partnerUser = await userRepository.findById(partner.user);

    if (
        !partnerUser ||
        partnerUser.isDeleted ||
        !canEarnReferral(partnerUser.status)
    ) {
        return null;
    }

    const newUser = await userRepository.findById(newUserId);

    if (!newUser) {
        return null;
    }

    if (partner.user.toString() === newUserId.toString()) {
        return null;
    }

    const existingReferral =
        await referralRepository.findByReferredUserId(newUserId);

    if (existingReferral || newUser.referredBy) {
        return partner;
    }

    await userRepository.update(newUserId, {
        referredBy: partner.user,
    });

    await referralRepository.create({
        partner: partner._id,
        partnerUser: partner.user,
        referredUser: newUserId,
        partnerCode: partner.partnerCode,
        status: "REGISTERED",
    });

    await partnerRepository.incrementReferrals(partner._id);

    // Same admin "User Referral" reward settings apply to partner-code signups
    try {
        const userReferralService = require("../user/userReferral.service");
        const notificationService = require("../notification/notification.service");
        const granted = await userReferralService.applyReferralRewards(
            partner.user,
            newUserId
        );

        if (granted.referrerRewardId) {
            await notificationService.create(partner.user, {
                title: "Referral Reward",
                message: "You earned a reward for referring a new user",
                type: "SUCCESS",
            });
        }

        if (granted.refereeRewardId) {
            await notificationService.create(newUserId, {
                title: "Welcome Reward",
                message: "You received a signup referral reward",
                type: "SUCCESS",
            });
        }
    } catch (err) {
        console.error("Partner referral reward grant failed:", err.message);
    }

    return partner;
};
