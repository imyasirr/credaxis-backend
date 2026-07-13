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
            application: formatPartner(partner),
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
            application: formatPartner(partner),
        });
    }

    if (partner.status === "REJECTED") {
        return formatRegistrationStatus({
            step: "REJECTED",
            canApply: true,
            canUpdate: true,
            nextAction: "resubmit",
            message: partner.remarks || "Application rejected. You can re-apply",
            application: formatPartner(partner),
        });
    }

    return formatRegistrationStatus({
        step: partner.status,
        canApply: false,
        canUpdate: false,
        nextAction: "open_dashboard",
        message: "Partner application status fetched",
        application: formatPartner(partner),
    });
};

exports.validatePartnerCode = async (code) => {
    const partner = await partnerRepository.findByPartnerCode(code);

    if (!partner) {
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
        throw new ApiError(400, "Shop photo and PAN document are required");
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

    return formatPartner(partner);
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

    const recentRecords = await referralRepository.findByPartnerUserId(userId, {
        skip: 0,
        limit: 5,
    });

    const userIds = recentRecords
        .map((item) => item.referredUser?._id || item.referredUser)
        .filter(Boolean);

    const profileMap = await getProfileMap(userIds);

    return {
        partner: formatPartner(partner),
        stats: {
            totalReferrals: partner.totalReferrals,
            totalEarnings: partner.totalEarnings,
            commissionRate: partner.commissionRate,
            partnerCode: partner.partnerCode,
        },
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
    return list.map(formatPartner);
};

exports.getAllPartners = async () => {
    const list = await partnerRepository.findByStatus(null);
    return list.filter((p) => p.status === "APPROVED").map(formatPartner);
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

    await userRepository.update(partner.user, {
        role: partnerRole._id,
        referralCode: partnerCode,
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

    return partner;
};
