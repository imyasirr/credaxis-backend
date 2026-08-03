const mongoose = require("mongoose");
const UserGamePlay = require("./userGamePlay.model");
const User = require("../user/model");
const ApiError = require("../../../utils/ApiError");

const GAME_META = {
    WHEEL: {
        gameType: "WHEEL",
        title: "Spin Wheel",
        description: "Spin and win prizes",
        webviewPath: "/games/?game=wheel",
    },
    SCRATCH: {
        gameType: "SCRATCH",
        title: "Scratch Card",
        description: "Scratch to reveal your prize",
        webviewPath: "/games/?game=scratch",
    },
    SHUFFLE: {
        gameType: "SHUFFLE",
        title: "Card Shuffle",
        description: "Pick a card after the shuffle",
        webviewPath: "/games/?game=shuffle",
    },
    BUBBLE: {
        gameType: "BUBBLE",
        title: "Bubble Pop",
        description: "Slice comets and earn coins",
        webviewPath: "/games/?game=bubble",
    },
};

const normalizeGameType = (raw) => {
    const gameType = String(raw || "").toUpperCase();
    if (!GAME_META[gameType]) {
        throw new ApiError(
            400,
            "gameType must be WHEEL, SCRATCH, SHUFFLE or BUBBLE"
        );
    }
    return gameType;
};

const remainingOf = (doc) =>
    Math.max(0, Number(doc.totalPlays || 0) - Number(doc.usedPlays || 0));

const isExpired = (doc, now = new Date()) =>
    Boolean(doc.expiresAt && new Date(doc.expiresAt) < now);

/** Mark expired ACTIVE rows for a user */
const expireStale = async (userId) => {
    const now = new Date();
    await UserGamePlay.updateMany(
        {
            user: userId,
            status: "ACTIVE",
            expiresAt: { $ne: null, $lt: now },
        },
        { $set: { status: "EXPIRED" } }
    );
};

const formatEntitlement = (doc) => {
    const data = doc.toObject ? doc.toObject() : doc;
    return {
        id: String(data._id),
        gameType: data.gameType,
        totalPlays: data.totalPlays,
        usedPlays: data.usedPlays,
        remainingPlays: remainingOf(data),
        expiresAt: data.expiresAt || null,
        status: data.status,
        source: data.source,
        createdAt: data.createdAt,
    };
};

/**
 * Grant plays to a user (admin / rules).
 * Body: { userId | mobile, gameType, plays, expiresAt?, note? }
 */
exports.grantPlays = async ({
    userId,
    mobile,
    gameType: gameTypeRaw,
    plays = 1,
    expiresAt = null,
    note = "",
    source = "ADMIN",
    ruleId = null,
    grantedBy = null,
}) => {
    const gameType = normalizeGameType(gameTypeRaw);
    let targetUserId = userId;

    if (!targetUserId && mobile) {
        const user = await User.findOne({
            mobile: String(mobile).trim(),
            isDeleted: false,
        }).select("_id");
        if (!user) throw new ApiError(404, "User not found for mobile");
        targetUserId = user._id;
    }

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(String(targetUserId))) {
        throw new ApiError(400, "userId or mobile is required");
    }

    const user = await User.findOne({
        _id: targetUserId,
        isDeleted: false,
    }).select("_id");
    if (!user) throw new ApiError(404, "User not found");

    const totalPlays = Math.min(100, Math.max(1, Math.floor(Number(plays) || 1)));
    let exp = null;
    if (expiresAt) {
        exp = new Date(expiresAt);
        if (Number.isNaN(exp.getTime())) {
            throw new ApiError(400, "Invalid expiresAt");
        }
    }

    const doc = await UserGamePlay.create({
        user: targetUserId,
        gameType,
        totalPlays,
        usedPlays: 0,
        expiresAt: exp,
        status: "ACTIVE",
        source: source || "ADMIN",
        ruleId: ruleId || null,
        grantedBy: grantedBy || null,
        note: String(note || "").slice(0, 300),
    });

    return formatEntitlement(doc);
};

/** Available play count per gameType for a user */
exports.getAvailableCounts = async (userId) => {
    await expireStale(userId);
    const now = new Date();
    const rows = await UserGamePlay.find({
        user: userId,
        status: "ACTIVE",
        $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    }).lean();

    const counts = {
        WHEEL: 0,
        SCRATCH: 0,
        SHUFFLE: 0,
        BUBBLE: 0,
    };

    for (const row of rows) {
        counts[row.gameType] =
            (counts[row.gameType] || 0) + remainingOf(row);
    }

    return counts;
};

/**
 * Games list for mobile app home / rewards games screen.
 */
exports.getMyGames = async (userId) => {
    const counts = await exports.getAvailableCounts(userId);

    let bubbleEnabled = true;
    try {
        // Lazy require avoids circular dependency with bubbleGame/service
        const bubbleGameService = require("../bubbleGame/service");
        const cfg = await bubbleGameService.getPublicConfig();
        bubbleEnabled = cfg.enabled !== false;
    } catch {
        bubbleEnabled = true;
    }

    const games = [];
    for (const key of Object.keys(GAME_META)) {
        const availablePlays = counts[key] || 0;
        if (availablePlays <= 0) continue;
        if (key === "BUBBLE" && !bubbleEnabled) continue;

        const meta = GAME_META[key];
        games.push({
            ...meta,
            availablePlays,
            webviewUrl: meta.webviewPath,
        });
    }

    return {
        games,
        totalAvailablePlays: games.reduce(
            (sum, g) => sum + g.availablePlays,
            0
        ),
    };
};

/**
 * Consume 1 play for gameType. Throws if none left.
 * Uses soonest-expiring ACTIVE entitlement first.
 */
exports.consumePlay = async (userId, gameTypeRaw) => {
    const gameType = normalizeGameType(gameTypeRaw);
    await expireStale(userId);

    const now = new Date();
    const rows = await UserGamePlay.find({
        user: userId,
        gameType,
        status: "ACTIVE",
        $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    }).sort({ expiresAt: 1, createdAt: 1 });

    const row = rows.find((r) => remainingOf(r) > 0);
    if (!row) {
        throw new ApiError(
            403,
            `No available plays for ${GAME_META[gameType].title}`
        );
    }

    row.usedPlays = Number(row.usedPlays || 0) + 1;
    if (remainingOf(row) <= 0) {
        row.status = "EXHAUSTED";
    }
    await row.save();

    const counts = await exports.getAvailableCounts(userId);

    return {
        gameType,
        entitlementId: String(row._id),
        remainingPlays: counts[gameType] || 0,
    };
};

exports.hasAvailablePlay = async (userId, gameTypeRaw) => {
    const gameType = normalizeGameType(gameTypeRaw);
    const counts = await exports.getAvailableCounts(userId);
    return (counts[gameType] || 0) > 0;
};

exports.GAME_META = GAME_META;
exports.normalizeGameType = normalizeGameType;
