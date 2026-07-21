const UserReward = require("./model");
const { computeExpiresAt, formatUserReward } = require("./mapper");
const coinService = require("../coins/service");
const ApiError = require("../../utils/ApiError");

const expireStaleRewards = async (userId) => {
    await UserReward.updateMany(
        {
            user: userId,
            status: "PENDING",
            expiresAt: { $ne: null, $lt: new Date() },
        },
        { $set: { status: "EXPIRED" } }
    );
};

exports.grantReward = async ({
    userId,
    gameType,
    prize,
    wonAt = new Date(),
    valueOverride = null,
    source = "OTHER",
    ruleId = null,
    grantedBy = null,
}) => {
    const expiryDays = Number(prize.expiryDays) || 0;
    const value =
        valueOverride !== null && valueOverride !== undefined
            ? Number(valueOverride)
            : Number(prize.value) || 0;

    const reward = await UserReward.create({
        user: userId,
        gameType,
        prizeId: prize._id || prize.id,
        prizeTitle: prize.title,
        prizeType: prize.prizeType,
        value: Number.isNaN(value) ? 0 : value,
        color: prize.color || "#6366f1",
        expiryDays,
        status:
            prize.prizeType === "NO_PRIZE" || prize.prizeType === "COINS"
                ? "CLAIMED"
                : "PENDING",
        wonAt,
        expiresAt: computeExpiresAt(expiryDays, wonAt),
        claimedAt:
            prize.prizeType === "NO_PRIZE" || prize.prizeType === "COINS"
                ? wonAt
                : null,
        source: source || "OTHER",
        ruleId: ruleId || null,
        grantedBy: grantedBy || null,
    });

    if (prize.prizeType === "COINS" && value > 0) {
        const coinSource =
            source === "GAME" || gameType ? "GAME" : "REWARD";

        await coinService.creditCoins(userId, {
            amount: value,
            source: coinSource,
            referenceId: String(reward._id),
            description: `Won ${value} coins: ${prize.title}`,
            notify: true,
        });
    }

    return formatUserReward(reward);
};

exports.getMyRewards = async (userId, query = {}) => {
    await expireStaleRewards(userId);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = { user: userId };

    if (query.status) {
        filter.status = String(query.status).toUpperCase();
    }

    if (query.gameType) {
        filter.gameType = String(query.gameType).toUpperCase();
    }

    if (query.prizeType) {
        filter.prizeType = String(query.prizeType).toUpperCase();
    }

    // usable = still claimable
    if (query.usable === "true" || query.usable === "1") {
        filter.status = "PENDING";
        filter.$or = [
            { expiresAt: null },
            { expiresAt: { $gte: new Date() } },
        ];
    }

    const [rewards, total, pendingCount, claimedCount, expiredCount, cancelledCount] =
        await Promise.all([
            UserReward.find(filter)
                .sort({ wonAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            UserReward.countDocuments(filter),
            UserReward.countDocuments({
                user: userId,
                status: "PENDING",
                $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }],
            }),
            UserReward.countDocuments({ user: userId, status: "CLAIMED" }),
            UserReward.countDocuments({ user: userId, status: "EXPIRED" }),
            UserReward.countDocuments({ user: userId, status: "CANCELLED" }),
        ]);

    return {
        rewards: rewards.map((item) => formatUserReward(item)),
        stats: {
            total: pendingCount + claimedCount + expiredCount + cancelledCount,
            pendingCount,
            claimedCount,
            expiredCount,
            cancelledCount,
            usableCount: pendingCount,
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getMyRewardStats = async (userId) => {
    await expireStaleRewards(userId);

    const [pendingCount, claimedCount, expiredCount, cancelledCount] =
        await Promise.all([
            UserReward.countDocuments({
                user: userId,
                status: "PENDING",
                $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }],
            }),
            UserReward.countDocuments({ user: userId, status: "CLAIMED" }),
            UserReward.countDocuments({ user: userId, status: "EXPIRED" }),
            UserReward.countDocuments({ user: userId, status: "CANCELLED" }),
        ]);

    return {
        total: pendingCount + claimedCount + expiredCount + cancelledCount,
        pendingCount,
        claimedCount,
        expiredCount,
        cancelledCount,
        usableCount: pendingCount,
    };
};

exports.getMyRewardById = async (userId, rewardId) => {
    await expireStaleRewards(userId);

    const reward = await UserReward.findOne({
        _id: rewardId,
        user: userId,
    });

    if (!reward) {
        throw new ApiError(404, "Reward not found");
    }

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
        throw new ApiError(400, "Reward already claimed / used");
    }

    if (reward.status === "CANCELLED") {
        throw new ApiError(400, "Reward has been cancelled");
    }

    if (reward.status === "EXPIRED") {
        throw new ApiError(400, "Reward has expired");
    }

    if (reward.expiresAt && new Date(reward.expiresAt) < new Date()) {
        reward.status = "EXPIRED";
        await reward.save();
        throw new ApiError(400, "Reward has expired");
    }

    if (reward.prizeType === "NO_PRIZE") {
        throw new ApiError(400, "No prize to claim");
    }

    if (reward.prizeType === "COINS") {
        if (reward.value > 0) {
            await coinService.creditCoins(userId, {
                amount: reward.value,
                source: "REWARD",
                referenceId: String(reward._id),
                description: `Claimed ${reward.value} coins: ${reward.prizeTitle}`,
                notify: true,
            });
        }

        reward.status = "CLAIMED";
        reward.claimedAt = new Date();
        await reward.save();
        return formatUserReward(reward);
    }

    reward.status = "CLAIMED";
    reward.claimedAt = new Date();
    await reward.save();

    return formatUserReward(reward);
};
