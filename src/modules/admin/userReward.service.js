const User = require("../user/model");
const UserProfile = require("../user/profile.model");
const UserReward = require("../rewards/model");
const { formatUserReward } = require("../rewards/mapper");
const ApiError = require("../../utils/ApiError");

const SORTABLE_FIELDS = {
    wonAt: "wonAt",
    expiresAt: "expiresAt",
    status: "status",
    gameType: "gameType",
    prizeType: "prizeType",
    createdAt: "createdAt",
};

const buildProfileMap = async (rewards) => {
    const userIds = rewards
        .map((reward) => reward.user?._id?.toString())
        .filter(Boolean);

    if (!userIds.length) {
        return {};
    }

    const profiles = await UserProfile.find({ user: { $in: userIds } });

    return Object.fromEntries(
        profiles.map((profile) => [profile.user.toString(), profile])
    );
};

exports.getUserRewards = async (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.userId) {
        filter.user = query.userId;
    }

    if (query.gameType) {
        filter.gameType = query.gameType;
    }

    if (query.prizeType) {
        filter.prizeType = query.prizeType;
    }

    if (query.status) {
        if (query.status === "EXPIRED") {
            filter.status = "PENDING";
            filter.expiresAt = { $lt: new Date() };
        } else {
            filter.status = query.status;
        }
    }

    if (query.search) {
        const search = query.search.trim();
        const users = await User.find({
            $or: [
                { mobile: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ],
            isDeleted: false,
        }).select("_id");

        const userIds = users.map((user) => user._id);

        filter.$or = [
            { prizeTitle: { $regex: search, $options: "i" } },
            { user: { $in: userIds } },
        ];
    }

    const sortField = SORTABLE_FIELDS[query.sortBy] || SORTABLE_FIELDS.wonAt;
    const sortDir = query.sortOrder === "asc" ? 1 : -1;

    const [rewards, total, pendingCount, claimedCount, expiredCount] =
        await Promise.all([
            UserReward.find(filter)
                .populate("user", "mobile email")
                .sort({ [sortField]: sortDir })
                .skip(skip)
                .limit(limit),
            UserReward.countDocuments(filter),
            UserReward.countDocuments({ status: "PENDING" }),
            UserReward.countDocuments({ status: "CLAIMED" }),
            UserReward.countDocuments({
                $or: [
                    { status: "EXPIRED" },
                    {
                        status: "PENDING",
                        expiresAt: { $lt: new Date(), $ne: null },
                    },
                ],
            }),
        ]);

    const profileMap = await buildProfileMap(rewards);

    return {
        rewards: rewards.map((reward) =>
            formatUserReward(reward, profileMap)
        ),
        stats: {
            total,
            pendingCount,
            claimedCount,
            expiredCount,
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getUserRewardById = async (rewardId) => {
    const reward = await UserReward.findById(rewardId).populate(
        "user",
        "mobile email"
    );

    if (!reward) {
        throw new ApiError(404, "User reward not found");
    }

    const profileMap = await buildProfileMap([reward]);

    return formatUserReward(reward, profileMap);
};

exports.updateUserRewardStatus = async (rewardId, status) => {
    const reward = await UserReward.findById(rewardId);

    if (!reward) {
        throw new ApiError(404, "User reward not found");
    }

    reward.status = status;

    if (status === "CLAIMED") {
        reward.claimedAt = new Date();
    }

    if (status === "PENDING") {
        reward.claimedAt = null;
    }

    await reward.save();

    const populated = await UserReward.findById(rewardId).populate(
        "user",
        "mobile email"
    );
    const profileMap = await buildProfileMap([populated]);

    return formatUserReward(populated, profileMap);
};
