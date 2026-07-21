const kycRepository = require("./repository");
const Wallet = require("../wallet/model");
const UserProfile = require("../user/profile.model");
const notificationService = require("../notification/service");

const ApiError = require("../../utils/ApiError");
const { formatKyc } = require("./mapper");
const { getUploadPath } = require("../../middleware/upload.middleware");

const getFilePath = (files, field) => {
    const file = files?.[field]?.[0];

    if (!file) {
        return null;
    }

    return getUploadPath("kyc", file.filename);
};

const buildProfileMap = async (userIds) => {
    const ids = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))];

    if (!ids.length) {
        return {};
    }

    const profiles = await UserProfile.find({ user: { $in: ids } });

    return Object.fromEntries(
        profiles.map((profile) => [profile.user.toString(), profile])
    );
};

const formatKycWithProfile = async (kyc) => {
    if (!kyc) return null;

    const userId = (kyc.user?._id || kyc.user)?.toString();
    const profileMap = await buildProfileMap([userId]);

    // Ensure user is populated for mobile/email
    let doc = kyc;
    if (!kyc.user || typeof kyc.user !== "object" || kyc.user.mobile === undefined) {
        doc = await kycRepository.findByIdWithUser(kyc._id);
    }

    return formatKyc(doc, profileMap);
};

exports.getMyKyc = async (userId) => {
    const kyc = await kycRepository.findByUserId(userId);

    if (!kyc) {
        return {
            status: "NOT_SUBMITTED",
            message: "KYC not submitted yet",
            canSubmit: true,
        };
    }

    return {
        ...(await formatKycWithProfile(kyc)),
        canSubmit: kyc.status === "REJECTED",
    };
};

exports.submitKyc = async (userId, body, files) => {
    const existing = await kycRepository.findByUserId(userId);

    if (existing && ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(existing.status)) {
        throw new ApiError(400, `KYC already ${existing.status.toLowerCase()}`);
    }

    const kycData = {
        user: userId,
        panNumber: body.panNumber.trim().toUpperCase(),
        aadhaarNumber: body.aadhaarNumber.trim(),
        panImage: getFilePath(files, "panImage"),
        aadhaarFront: getFilePath(files, "aadhaarFront"),
        aadhaarBack: getFilePath(files, "aadhaarBack"),
        selfie: getFilePath(files, "selfie"),
        status: "PENDING",
        remarks: "",
        verifiedBy: null,
        verifiedAt: null,
    };

    if (!kycData.panImage || !kycData.aadhaarFront || !kycData.aadhaarBack || !kycData.selfie) {
        throw new ApiError(400, "All KYC documents are required");
    }

    let kyc;

    if (existing?.status === "REJECTED") {
        kyc = await kycRepository.update(existing._id, kycData);
    } else {
        kyc = await kycRepository.create(kycData);
    }

    await notificationService.create(userId, {
        title: "KYC Submitted",
        message: "Your KYC documents have been submitted for review",
        type: "INFO",
    });

    return formatKycWithProfile(kyc);
};

exports.getPendingKycList = async () => {
    const list = await kycRepository.findPending();
    const userIds = list.map((item) => item.user?._id || item.user);
    const profileMap = await buildProfileMap(userIds);

    return list.map((item) => formatKyc(item, profileMap));
};

exports.approveKyc = async (kycId, adminId) => {
    const kyc = await kycRepository.findById(kycId);

    if (!kyc) {
        throw new ApiError(404, "KYC not found");
    }

    if (kyc.status === "APPROVED") {
        throw new ApiError(400, "KYC already approved");
    }

    kyc.status = "APPROVED";
    kyc.verifiedBy = adminId;
    kyc.verifiedAt = new Date();
    kyc.remarks = "";
    await kyc.save();

    await Wallet.updateOne({ user: kyc.user }, { isKycCompleted: true });

    await notificationService.create(kyc.user, {
        title: "KYC Approved",
        message: "Your KYC has been verified successfully",
        type: "SUCCESS",
    });

    try {
        const rewardRuleService = require("../rewards/rewardRule.service");
        await rewardRuleService.applyTrigger("KYC_APPROVED", kyc.user);
    } catch (err) {
        console.error("KYC_APPROVED reward rules failed:", err.message);
    }

    return formatKycWithProfile(kyc);
};

exports.rejectKyc = async (kycId, adminId, remarks) => {
    const kyc = await kycRepository.findById(kycId);

    if (!kyc) {
        throw new ApiError(404, "KYC not found");
    }

    kyc.status = "REJECTED";
    kyc.verifiedBy = adminId;
    kyc.verifiedAt = new Date();
    kyc.remarks = remarks;
    await kyc.save();

    await Wallet.updateOne({ user: kyc.user }, { isKycCompleted: false });

    await notificationService.create(kyc.user, {
        title: "KYC Rejected",
        message: remarks || "Your KYC was rejected. Please resubmit.",
        type: "ERROR",
    });

    return formatKycWithProfile(kyc);
};

/** Shared helper — attach identity KYC to a userId */
exports.getKycByUserId = async (userId) => {
    const kyc = await kycRepository.findByUserId(userId);
    if (!kyc) {
        return {
            status: "NOT_SUBMITTED",
            canSubmit: true,
            message: "KYC not submitted yet",
        };
    }
    return {
        ...(await formatKycWithProfile(kyc)),
        canSubmit: kyc.status === "REJECTED",
    };
};
