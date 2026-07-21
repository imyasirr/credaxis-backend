const kycService = require("./service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getMyKyc = asyncHandler(async (req, res) => {
    const kyc = await kycService.getMyKyc(req.user.id);
    return response.success(res, "KYC fetched successfully", kyc);
});

exports.submitKyc = asyncHandler(async (req, res) => {
    const kyc = await kycService.submitKyc(req.user.id, req.body, req.files);
    return response.success(res, "KYC submitted successfully", kyc, 201);
});

exports.getPendingList = asyncHandler(async (req, res) => {
    const list = await kycService.getPendingKycList();
    return response.success(res, "Pending KYC list fetched", list);
});

exports.approveKyc = asyncHandler(async (req, res) => {
    const kyc = await kycService.approveKyc(req.params.id, req.user.id);
    return response.success(res, "KYC approved successfully", kyc);
});

exports.rejectKyc = asyncHandler(async (req, res) => {
    const kyc = await kycService.rejectKyc(
        req.params.id,
        req.user.id,
        req.body.remarks
    );
    return response.success(res, "KYC rejected", kyc);
});
