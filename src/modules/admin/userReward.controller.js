const adminUserRewardService = require("./userReward.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getUserRewards = asyncHandler(async (req, res) => {
    const data = await adminUserRewardService.getUserRewards(req.query);
    return response.success(res, "User rewards fetched successfully", data);
});

exports.getUserRewardById = asyncHandler(async (req, res) => {
    const data = await adminUserRewardService.getUserRewardById(req.params.id);
    return response.success(res, "User reward fetched successfully", data);
});

exports.updateUserRewardStatus = asyncHandler(async (req, res) => {
    const data = await adminUserRewardService.updateUserRewardStatus(
        req.params.id,
        req.body.status
    );
    return response.success(res, "User reward status updated", data);
});
