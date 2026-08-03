const BubbleGameSetting = require("./model");
const coinService = require("../coins/service");
const userGamePlayService = require("../games/userGamePlay.service");
const ApiError = require("../../../utils/ApiError");

const DEFAULTS = {
    key: "BUBBLE_POP",
    enabled: true,
    totalBubbles: 30,
    fallSpeed: 2,
    coinsPerBubble: 1,
    bombCount: 2,
    maxMisses: 3,
    maxCoinsPerPlay: 100,
};

const formatSettings = (doc) => {
    const data = doc?.toObject ? doc.toObject() : doc || DEFAULTS;
    return {
        enabled: Boolean(data.enabled),
        totalBubbles: Number(data.totalBubbles) || DEFAULTS.totalBubbles,
        fallSpeed: Number(data.fallSpeed)
            ? Math.max(2, Number(data.fallSpeed))
            : DEFAULTS.fallSpeed,
        coinsPerBubble: Number(data.coinsPerBubble) || 0,
        bombCount: Number(data.bombCount) || 0,
        maxMisses: Number(data.maxMisses) || DEFAULTS.maxMisses,
        maxCoinsPerPlay:
            Number(data.maxCoinsPerPlay) || DEFAULTS.maxCoinsPerPlay,
        updatedAt: data.updatedAt || null,
    };
};

exports.getOrCreateSettings = async () => {
    let doc = await BubbleGameSetting.findOne({ key: "BUBBLE_POP" });
    if (!doc) {
        doc = await BubbleGameSetting.create(DEFAULTS);
    }
    return doc;
};

exports.getSettings = async () => {
    const doc = await exports.getOrCreateSettings();
    return formatSettings(doc);
};

/** Public config for apps / admin preview (no secrets). */
exports.getPublicConfig = async () => {
    const settings = await exports.getSettings();
    if (!settings.enabled) {
        return {
            enabled: false,
            message: "Bubble Pop is currently disabled",
        };
    }
    return {
        enabled: true,
        totalBubbles: settings.totalBubbles,
        fallSpeed: settings.fallSpeed,
        coinsPerBubble: settings.coinsPerBubble,
        bombCount: settings.bombCount,
        maxMisses: settings.maxMisses,
        maxCoinsPerPlay: settings.maxCoinsPerPlay,
    };
};

exports.updateSettings = async (body = {}) => {
    const doc = await exports.getOrCreateSettings();

    if (body.enabled !== undefined) {
        doc.enabled = Boolean(body.enabled);
    }
    if (body.totalBubbles !== undefined) {
        doc.totalBubbles = Math.min(
            200,
            Math.max(5, Number(body.totalBubbles) || DEFAULTS.totalBubbles)
        );
    }
    if (body.fallSpeed !== undefined) {
        doc.fallSpeed = Math.min(
            4,
            Math.max(2, Number(body.fallSpeed) || DEFAULTS.fallSpeed)
        );
    }
    if (body.coinsPerBubble !== undefined) {
        doc.coinsPerBubble = Math.min(
            100,
            Math.max(0, Number(body.coinsPerBubble) || 0)
        );
    }
    if (body.bombCount !== undefined) {
        doc.bombCount = Math.min(
            30,
            Math.max(0, Number(body.bombCount) || 0)
        );
    }
    if (body.maxMisses !== undefined) {
        doc.maxMisses = Math.min(
            20,
            Math.max(1, Number(body.maxMisses) || DEFAULTS.maxMisses)
        );
    }
    if (body.maxCoinsPerPlay !== undefined) {
        doc.maxCoinsPerPlay = Math.min(
            10000,
            Math.max(1, Number(body.maxCoinsPerPlay) || DEFAULTS.maxCoinsPerPlay)
        );
    }

    // Bombs cannot exceed total bubbles
    if (doc.bombCount > doc.totalBubbles) {
        doc.bombCount = doc.totalBubbles;
    }

    await doc.save();
    return formatSettings(doc);
};

/**
 * Finish a play: credit coins for popped bubbles (server clamps to settings).
 * Body: { bubblesPopped: number, hitBomb?: boolean }
 */
exports.completePlay = async (userId, body = {}) => {
    const settings = await exports.getSettings();

    if (!settings.enabled) {
        throw new ApiError(400, "Bubble Pop is currently disabled");
    }

    // Consume one Bubble play entitlement for this round
    const consumed = await userGamePlayService.consumePlay(userId, "BUBBLE");

    if (body.hitBomb) {
        return {
            bubblesPopped: 0,
            coinsEarned: 0,
            hitBomb: true,
            remainingPlays: consumed.remainingPlays,
            message: "Bomb hit — no coins this round",
            coinWallet: await coinService.getMyCoins(userId),
        };
    }

    let popped = Math.floor(Number(body.bubblesPopped) || 0);
    if (popped < 0) popped = 0;
    if (popped > settings.totalBubbles) {
        popped = settings.totalBubbles;
    }

    let coins = popped * settings.coinsPerBubble;
    if (coins > settings.maxCoinsPerPlay) {
        coins = settings.maxCoinsPerPlay;
    }

    let coinWallet = await coinService.getMyCoins(userId);

    if (coins > 0) {
        coinWallet = await coinService.creditCoins(userId, {
            amount: coins,
            source: "GAME",
            description: `Bubble Pop — ${popped} bubble${popped === 1 ? "" : "s"}`,
            referenceId: `bubble_${userId}_${Date.now()}`,
        });
    }

    return {
        bubblesPopped: popped,
        coinsPerBubble: settings.coinsPerBubble,
        coinsEarned: coins,
        hitBomb: false,
        remainingPlays: consumed.remainingPlays,
        coinWallet,
        message:
            coins > 0
                ? `${coins} coin${coins === 1 ? "" : "s"} added to your wallet`
                : "No coins earned this round",
    };
};
