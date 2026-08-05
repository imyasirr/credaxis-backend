const service = require("./service");
const deletionService = require("./deletion.service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.getMyProfile = asyncHandler(async (req, res) => {
    const profile = await service.getMyProfile(req.user.id);
    return response.success(res, "Profile fetched successfully", profile);
});

exports.getDashboard = asyncHandler(async (req, res) => {
    const data = await service.getDashboard(req.user.id);
    return response.success(res, "Dashboard fetched successfully", data);
});

exports.completeProfile = asyncHandler(async (req, res) => {
    const profile = await service.completeProfile(
        req.user.id,
        req.body,
        req.file
    );
    return response.success(
        res,
        "Profile completed successfully",
        profile,
        201
    );
});

exports.updateProfile = asyncHandler(async (req, res) => {
    const profile = await service.updateProfile(
        req.user.id,
        req.body,
        req.file
    );
    return response.success(res, "Profile updated successfully", profile);
});

exports.deleteAvatar = asyncHandler(async (req, res) => {
    const profile = await service.deleteAvatar(req.user.id);
    return response.success(res, "Avatar deleted successfully", profile);
});

exports.getMyReferralLink = asyncHandler(async (req, res) => {
    const data = await service.getMyReferralLink(req.user.id, req.user.role);
    return response.success(res, "Referral info fetched", data);
});

exports.getMyReferrals = asyncHandler(async (req, res) => {
    const data = await service.getMyReferrals(
        req.user.id,
        req.query,
        req.user.role
    );
    return response.success(res, "Referrals fetched", data);
});

exports.requestDeletion = asyncHandler(async (req, res) => {
    const data = await deletionService.requestDeletion(req.user.id, req.body);
    return response.success(
        res,
        "Account deletion request submitted",
        data,
        201
    );
});

exports.getMyDeletionRequest = asyncHandler(async (req, res) => {
    const data = await deletionService.getMyDeletionRequest(req.user.id);
    return response.success(res, "Deletion request fetched", data);
});

exports.cancelDeletionRequest = asyncHandler(async (req, res) => {
    const data = await deletionService.cancelDeletionRequest(req.user.id);
    return response.success(res, "Deletion request cancelled", data);
});
