const mongoose = require("mongoose");

const UserReward = require("./model");
const { computeExpiresAt, formatUserReward } = require("./mapper");
const coinService = require("../coins/service");
const walletService = require("../wallet/service");
const notificationService = require("../notification/service");
const { getPartnerAccess } = require("../partner/access");
const {
    creditPartnerBalance,
} = require("../creditToken/tokenTransfer.service");
const TokenTransfer = require("../creditToken/tokenTransfer.model");
const { TOKEN_TYPES } = TokenTransfer;
const ApiError = require("../../../utils/ApiError");

const AUTO_CLAIM_TYPES = new Set(["NO_PRIZE", "COINS", "CASH", "TOKEN", "COUPON"]);

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

const resolveTokenType = (prizeOrReward) => {
    const raw = String(prizeOrReward?.tokenType || "CRIF").toUpperCase();
    return TOKEN_TYPES.includes(raw) ? raw : "CRIF";
};

const generateTransferId = () =>
    `TT${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

/**
 * Apply ledger side-effects for a won/claimed prize.
 * Returns a short detail string for notification copy.
 */
const fulfillPrizeLedger = async ({
    userId,
    prizeType,
    value,
    rewardId,
    prizeTitle,
    source = "OTHER",
    gameType = null,
    tokenType = "CRIF",
    grantedBy = null,
}) => {
    const amount = Number(value) || 0;

    if (prizeType === "COINS") {
        if (amount > 0) {
            const coinSource =
                source === "GAME" || gameType ? "GAME" : "REWARD";
            await coinService.creditCoins(userId, {
                amount,
                source: coinSource,
                referenceId: String(rewardId),
                description: `Won ${amount} coins: ${prizeTitle}`,
                notify: false,
            });
        }
        return { kind: "COINS", amount };
    }

    if (prizeType === "CASH") {
        if (amount > 0) {
            await walletService.creditMoney(userId, {
                amount,
                referenceId: String(rewardId),
                description: `Won ₹${amount}: ${prizeTitle}`,
                notify: false,
            });
        }
        return { kind: "CASH", amount };
    }

    if (prizeType === "TOKEN") {
        const qty = Math.floor(amount);
        if (qty > 0) {
            const access = await getPartnerAccess(userId);
            if (access.isApproved && access.partner?._id) {
                const session = await mongoose.startSession();
                session.startTransaction();
                try {
                    await creditPartnerBalance(
                        access.partner._id,
                        userId,
                        tokenType,
                        qty,
                        session
                    );

                    await TokenTransfer.create(
                        [
                            {
                                partner: access.partner._id,
                                partnerUser: userId,
                                transferredBy: grantedBy || userId,
                                tokenType,
                                quantity: qty,
                                reason: "BONUS",
                                note: `Game/reward: ${prizeTitle}`,
                                transferId: generateTransferId(),
                                status: "SUCCESS",
                                transferredAt: new Date(),
                            },
                        ],
                        { session }
                    );

                    await session.commitTransaction();
                    return {
                        kind: "TOKEN",
                        amount: qty,
                        tokenType,
                        partnerCredited: true,
                    };
                } catch (error) {
                    await session.abortTransaction();
                    throw error;
                } finally {
                    session.endSession();
                }
            }
        }
        return {
            kind: "TOKEN",
            amount: qty > 0 ? qty : amount,
            tokenType,
            partnerCredited: false,
        };
    }

    if (prizeType === "COUPON") {
        return { kind: "COUPON", amount };
    }

    return { kind: prizeType || "OTHER", amount };
};

const buildGrantMessage = (prizeType, value, title, fulfillMeta) => {
    if (prizeType === "COINS") {
        return `You received ${value} coins — ${title}`;
    }
    if (prizeType === "CASH") {
        return `₹${value} added to your wallet — ${title}`;
    }
    if (prizeType === "TOKEN") {
        if (fulfillMeta?.partnerCredited) {
            return `${value} ${fulfillMeta.tokenType || "CRIF"} tokens added — ${title}`;
        }
        return `You won ${value} tokens — ${title}. Partner account required to use tokens.`;
    }
    if (prizeType === "COUPON") {
        return `Coupon unlocked — ${title}${value ? ` (worth ₹${value})` : ""}`;
    }
    return `You received: ${title}${value ? ` (₹${value})` : ""}`;
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
    const prizeType = String(prize.prizeType || "NO_PRIZE").toUpperCase();
    const autoClaim = AUTO_CLAIM_TYPES.has(prizeType);
    const tokenType = resolveTokenType(prize);

    const reward = await UserReward.create({
        user: userId,
        gameType,
        prizeId: prize._id || prize.id,
        prizeTitle: prize.title,
        prizeType,
        value: Number.isNaN(value) ? 0 : value,
        color: prize.color || "#6366f1",
        expiryDays,
        status: autoClaim ? "CLAIMED" : "PENDING",
        wonAt,
        expiresAt: computeExpiresAt(expiryDays, wonAt),
        claimedAt: autoClaim ? wonAt : null,
        source: source || "OTHER",
        ruleId: ruleId || null,
        grantedBy: grantedBy || null,
    });

    let fulfillMeta = { kind: prizeType, amount: value };

    if (prizeType !== "NO_PRIZE") {
        fulfillMeta = await fulfillPrizeLedger({
            userId,
            prizeType,
            value,
            rewardId: reward._id,
            prizeTitle: prize.title,
            source,
            gameType,
            tokenType,
            grantedBy,
        });
    }

    if (prizeType !== "NO_PRIZE") {
        const isAdminGrant = source === "ADMIN" || Boolean(grantedBy);
        const title = isAdminGrant
            ? "Reward from admin"
            : "New reward unlocked";
        const message = buildGrantMessage(
            prizeType,
            value,
            prize.title,
            fulfillMeta
        );

        await notificationService.notifySafe(userId, {
            title,
            message,
            type: "SUCCESS",
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

    const fulfillMeta = await fulfillPrizeLedger({
        userId,
        prizeType: reward.prizeType,
        value: reward.value,
        rewardId: reward._id,
        prizeTitle: reward.prizeTitle,
        source: reward.source || "REWARD",
        gameType: reward.gameType,
        tokenType: resolveTokenType(reward),
        grantedBy: reward.grantedBy,
    });

    reward.status = "CLAIMED";
    reward.claimedAt = new Date();
    await reward.save();

    await notificationService.notifySafe(userId, {
        title: "Reward claimed",
        message: buildGrantMessage(
            reward.prizeType,
            reward.value,
            reward.prizeTitle,
            fulfillMeta
        ),
        type: "SUCCESS",
    });

    return formatUserReward(reward);
};
