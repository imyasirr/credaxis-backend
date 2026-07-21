const userRewardService = require("./service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getMyRewards = asyncHandler(async (req, res) => {
    const data = await userRewardService.getMyRewards(req.user.id, req.query);
    return response.success(res, "Rewards fetched successfully", data);
});

exports.getMyRewardStats = asyncHandler(async (req, res) => {
    const data = await userRewardService.getMyRewardStats(req.user.id);
    return response.success(res, "Reward stats fetched", data);
});

exports.getMyRewardById = asyncHandler(async (req, res) => {
    const data = await userRewardService.getMyRewardById(
        req.user.id,
        req.params.id
    );
    return response.success(res, "Reward fetched", data);
});

exports.claimReward = asyncHandler(async (req, res) => {
    const data = await userRewardService.claimReward(
        req.user.id,
        req.params.id
    );
    return response.success(res, "Reward claimed / used successfully", data);
});
