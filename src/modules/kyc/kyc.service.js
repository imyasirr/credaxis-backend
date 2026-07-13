const kycRepository = require("./kyc.repository");
const Wallet = require("../wallet/wallet.model");
const notificationService = require("../notification/notification.service");

const ApiError = require("../../utils/ApiError");
const { formatKyc } = require("./kyc.mapper");
const { getUploadPath } = require("../../middleware/upload.middleware");

const getFilePath = (files, field) => {
    const file = files?.[field]?.[0];

    if (!file) {
        return null;
    }

    return getUploadPath("kyc", file.filename);
};

exports.getMyKyc = async (userId) => {
    const kyc = await kycRepository.findByUserId(userId);

    if (!kyc) {
        return {
            status: "NOT_SUBMITTED",
            message: "KYC not submitted yet",
        };
    }

    return formatKyc(kyc);
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

    return formatKyc(kyc);
};

exports.getPendingKycList = async () => {
    const list = await kycRepository.findPending();
    return list.map(formatKyc);
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

    return formatKyc(kyc);
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

    await notificationService.create(kyc.user, {
        title: "KYC Rejected",
        message: remarks || "Your KYC was rejected. Please resubmit.",
        type: "ERROR",
    });

    return formatKyc(kyc);
};
