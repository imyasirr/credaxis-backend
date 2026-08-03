const WheelPrize = require("../rewards/wheelPrize.model");
const ScratchPrize = require("../rewards/scratchPrize.model");
const ShufflePrize = require("../rewards/shufflePrize.model");
const { grantReward } = require("../rewards/service");
const userGamePlayService = require("./userGamePlay.service");
const ApiError = require("../../../utils/ApiError");

const PRIZE_MODELS = {
    WHEEL: WheelPrize,
    SCRATCH: ScratchPrize,
    SHUFFLE: ShufflePrize,
};

const normalizeGameType = (raw) => {
    const gameType = String(raw || "").toUpperCase();
    if (!PRIZE_MODELS[gameType]) {
        throw new ApiError(400, "gameType must be WHEEL, SCRATCH or SHUFFLE");
    }
    return gameType;
};

const formatPublicPrize = (prize) => {
    if (!prize) return null;
    const data = prize.toObject ? prize.toObject() : prize;
    return {
        id: String(data._id),
        title: data.title,
        description: data.description || "",
        prizeType: data.prizeType,
        value: data.value ?? 0,
        frequency: data.frequency,
        color: data.color || "#6366f1",
        expiryDays: data.expiryDays ?? 30,
    };
};

const pickWeightedPrize = (prizes) => {
    const active = prizes.filter((p) => Number(p.frequency) > 0);
    if (!active.length) return null;

    const total = active.reduce((sum, p) => sum + Number(p.frequency), 0);
    let random = Math.random() * total;

    for (const prize of active) {
        random -= Number(prize.frequency);
        if (random <= 0) return prize;
    }

    return active[active.length - 1];
};

exports.getActivePrizes = async (gameTypeRaw) => {
    const gameType = normalizeGameType(gameTypeRaw);
    const Model = PRIZE_MODELS[gameType];

    const prizes = await Model.find({ status: "ACTIVE" })
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();

    const formatted = prizes.map(formatPublicPrize);
    const totalFrequency = formatted.reduce(
        (sum, p) => sum + Number(p.frequency || 0),
        0
    );

    return {
        gameType,
        prizes: formatted,
        totalFrequency,
    };
};

/**
 * Server-side weighted pick + grant reward. Client must not pick the winner.
 */
exports.play = async (userId, gameTypeRaw) => {
    const gameType = normalizeGameType(gameTypeRaw);
    const Model = PRIZE_MODELS[gameType];

    // Must have an available play entitlement
    const consumed = await userGamePlayService.consumePlay(userId, gameType);

    const prizes = await Model.find({ status: "ACTIVE" });
    const winner = pickWeightedPrize(prizes);

    if (!winner) {
        throw new ApiError(400, "No active prizes available for this game");
    }

    const userReward = await grantReward({
        userId,
        gameType,
        prize: winner,
        source: "GAME",
    });

    return {
        gameType,
        prize: formatPublicPrize(winner),
        userReward,
        remainingPlays: consumed.remainingPlays,
    };
};

exports.formatPublicPrize = formatPublicPrize;
exports.normalizeGameType = normalizeGameType;
