const UserReward = require("./userReward.model");
const { computeExpiresAt, formatUserReward } = require("./userReward.mapper");
const ApiError = require("../../utils/ApiError");

exports.grantReward = async ({
    userId,
    gameType,
    prize,
    wonAt = new Date(),
}) => {
    const expiryDays = Number(prize.expiryDays) || 0;

    const reward = await UserReward.create({
        user: userId,
        gameType,
        prizeId: prize._id || prize.id,
        prizeTitle: prize.title,
        prizeType: prize.prizeType,
        value: Number(prize.value) || 0,
        color: prize.color || "#6366f1",
        expiryDays,
        status: prize.prizeType === "NO_PRIZE" ? "CLAIMED" : "PENDING",
        wonAt,
        expiresAt: computeExpiresAt(expiryDays, wonAt),
        claimedAt: prize.prizeType === "NO_PRIZE" ? wonAt : null,
    });

    return formatUserReward(reward);
};

exports.claimReward = async (userId, rewardId) => {
    const reward = await UserReward.findOne({
        _id: rewardId,
        user: userId,
    });

    if (!reward) {
        throw new ApiError(404, "Reward not found");
    }

    if (reward.status === "CLAIMED") {
        throw new ApiError(400, "Reward already claimed");
    }

    if (reward.status === "CANCELLED") {
        throw new ApiError(400, "Reward has been cancelled");
    }

    if (reward.expiresAt && new Date(reward.expiresAt) < new Date()) {
        reward.status = "EXPIRED";
        await reward.save();
        throw new ApiError(400, "Reward has expired");
    }

    if (reward.prizeType === "NO_PRIZE") {
        throw new ApiError(400, "No prize to claim");
    }

    reward.status = "CLAIMED";
    reward.claimedAt = new Date();
    await reward.save();

    return formatUserReward(reward);
};
