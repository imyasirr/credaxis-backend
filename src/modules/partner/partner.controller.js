const partnerService = require("./partner.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.apply = asyncHandler(async (req, res) => {
    const data = await partnerService.apply(req.user.id, req.body, req.files);
    return response.success(res, "Partner application submitted", data, 201);
});

exports.getRegistrationStatus = asyncHandler(async (req, res) => {
    const data = await partnerService.getRegistrationStatus(req.user.id);
    return response.success(res, "Registration status fetched", data);
});

exports.validatePartnerCode = asyncHandler(async (req, res) => {
    const data = await partnerService.validatePartnerCode(req.params.code);
    return response.success(res, "Partner code validated", data);
});

exports.getMyPartner = asyncHandler(async (req, res) => {
    const data = await partnerService.getMyPartner(req.user.id);
    return response.success(res, "Partner details fetched", data);
});

exports.updateApplication = asyncHandler(async (req, res) => {
    const data = await partnerService.updateApplication(
        req.user.id,
        req.body,
        req.files
    );
    return response.success(res, "Partner application updated", data);
});

exports.getDashboard = asyncHandler(async (req, res) => {
    const data = await partnerService.getDashboard(req.user.id);
    return response.success(res, "Partner dashboard fetched", data);
});

exports.getReferralLink = asyncHandler(async (req, res) => {
    const data = await partnerService.getReferralLink(req.user.id);
    return response.success(res, "Referral link fetched", data);
});

exports.getReferralStats = asyncHandler(async (req, res) => {
    const data = await partnerService.getReferralStats(req.user.id);
    return response.success(res, "Referral stats fetched", data);
});

exports.getReferrals = asyncHandler(async (req, res) => {
    const data = await partnerService.getReferrals(req.user.id, req.query);
    return response.success(res, "Referrals fetched successfully", data);
});

exports.getApplications = asyncHandler(async (req, res) => {
    const data = await partnerService.getApplications(req.query.status);
    return response.success(res, "Partner applications fetched", data);
});

exports.getAllPartners = asyncHandler(async (req, res) => {
    const data = await partnerService.getAllPartners();
    return response.success(res, "Partners list fetched", data);
});

exports.approve = asyncHandler(async (req, res) => {
    const data = await partnerService.approve(
        req.params.id,
        req.user.id,
        req.body.commissionRate
    );
    return response.success(res, "Partner approved successfully", data);
});

exports.reject = asyncHandler(async (req, res) => {
    const data = await partnerService.reject(
        req.params.id,
        req.user.id,
        req.body.remarks
    );
    return response.success(res, "Partner application rejected", data);
});
