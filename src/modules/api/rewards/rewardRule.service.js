const mongoose = require("mongoose");
const RewardRule = require("./rewardRule.model");
const WheelPrize = require("./wheelPrize.model");
const ScratchPrize = require("./scratchPrize.model");
const ShufflePrize = require("./shufflePrize.model");
const User = require("../user/model");
const { grantReward } = require("./service");
const {
    formatRewardRule,
    getRewardRuleMeta,
} = require("./rewardRule.mapper");
const ApiError = require("../../../utils/ApiError");

const PRIZE_MODELS = {
    WHEEL: WheelPrize,
    SCRATCH: ScratchPrize,
    SHUFFLE: ShufflePrize,
};

const CATALOG_GAMES = ["WHEEL", "SCRATCH", "SHUFFLE"];
const PLAY_GAMES = ["WHEEL", "SCRATCH", "SHUFFLE", "BUBBLE"];

const normalizePlays = (raw) =>
    Math.min(100, Math.max(1, Math.floor(Number(raw) || 1)));

/** Rules always grant game plays. Prize comes when the user plays the game. */
const grantRulePlays = async ({
    userId,
    gameType,
    plays = 1,
    source = "RULE",
    ruleId = null,
    grantedBy = null,
    note = "",
}) => {
    const type = String(gameType || "").toUpperCase();
    if (!PLAY_GAMES.includes(type)) {
        throw new ApiError(400, "Invalid gameType for plays");
    }

    const userGamePlayService = require("../games/userGamePlay.service");
    return userGamePlayService.grantPlays({
        userId,
        gameType: type,
        plays: normalizePlays(plays),
        source,
        ruleId,
        grantedBy,
        note:
            note ||
            (source === "RULE"
                ? "Granted by reward rule"
                : "Granted by admin via rule"),
    });
};

const getPrizeModel = (gameType) => {
    const model = PRIZE_MODELS[String(gameType || "").toUpperCase()];
    if (!model) {
        throw new ApiError(
            400,
            "gameType must be WHEEL, SCRATCH or SHUFFLE for prize catalogs"
        );
    }
    return model;
};

exports.resolveActivePrize = async (gameType, prizeId) => {
    const prize = await getPrizeModel(gameType).findById(prizeId);
    if (!prize || prize.status !== "ACTIVE") {
        return null;
    }
    return prize;
};

/** Resolve mongo ids and/or 10-digit mobiles → User ObjectIds */
const resolveUserRefs = async (rawList = []) => {
    const ids = [];
    for (const raw of rawList) {
        const value = String(raw || "").trim();
        if (!value) continue;

        if (/^[6-9]\d{9}$/.test(value)) {
            const user = await User.findOne({
                mobile: value,
                isDeleted: false,
            }).select("_id");
            if (!user) {
                throw new ApiError(400, `No user found for mobile ${value}`);
            }
            ids.push(user._id);
            continue;
        }

        if (mongoose.Types.ObjectId.isValid(value)) {
            const user = await User.findOne({
                _id: value,
                isDeleted: false,
            }).select("_id");
            if (!user) {
                throw new ApiError(400, `No user found for id ${value}`);
            }
            ids.push(user._id);
            continue;
        }

        throw new ApiError(
            400,
            `Invalid user reference "${value}" — use mobile or user id`
        );
    }
    return ids;
};

const formatRule = (rule) => formatRewardRule(rule);

const isWithinSchedule = (rule, now = new Date()) => {
    if (rule.startAt && new Date(rule.startAt) > now) return false;
    if (rule.endAt && new Date(rule.endAt) < now) return false;
    return true;
};

const getRoleName = (user) => {
    if (!user?.role) return null;
    if (typeof user.role === "object" && user.role.name) {
        return String(user.role.name).toUpperCase();
    }
    return null;
};

const matchesAudience = (rule, user, { isApprovedPartner = false } = {}) => {
    const audience = rule.audience || "ALL";
    if (audience === "ALL") return true;

    const roleName = getRoleName(user);
    if (audience === "USER") {
        return roleName === "USER" || roleName === "PARTNER";
    }
    if (audience === "PARTNER") {
        return isApprovedPartner || roleName === "PARTNER";
    }

    if (audience === "SPECIFIC") {
        const ids = (rule.userIds || []).map((id) => id.toString());
        return ids.includes(user._id.toString());
    }
    return false;
};

/** Per-user cap based on play entitlements from this rule */
const canGrantToUser = async (rule, userId) => {
    if (rule.maxTotal != null && rule.grantCount >= rule.maxTotal) {
        return false;
    }

    if (rule.maxPerUser == null) return true;
    if (rule.maxPerUser <= 0) return false;

    const UserGamePlay = require("../games/userGamePlay.model");
    const count = await UserGamePlay.countDocuments({
        user: userId,
        ruleId: rule._id,
    });
    return count < rule.maxPerUser;
};

const executeRuleGrant = async (
    rule,
    userId,
    { source = "RULE", grantedBy = null } = {}
) => {
    const playSource = source === "ADMIN_MANUAL" ? "ADMIN" : "RULE";
    const play = await grantRulePlays({
        userId,
        gameType: rule.gameType,
        plays: rule.plays,
        source: playSource,
        ruleId: rule._id,
        grantedBy,
        note: `Game plays from rule: ${rule.name || rule._id}`,
    });
    return { kind: "PLAY", play, gameType: rule.gameType };
};

/**
 * Apply all enabled rules for a trigger to one user.
 * Each matching rule grants game play(s) only.
 */
exports.applyTrigger = async (trigger, userId, { skipManual = true } = {}) => {
    if (!userId || !trigger) return [];

    if (skipManual && trigger === "MANUAL") return [];

    const user = await User.findById(userId)
        .select("role status isDeleted mobile")
        .populate("role", "name");
    if (!user || user.isDeleted) return [];

    const { getPartnerAccess } = require("../partner/access");
    const partnerAccess = await getPartnerAccess(userId);

    const rules = await RewardRule.find({
        trigger: String(trigger).toUpperCase(),
        enabled: true,
    }).sort({ createdAt: 1 });

    const granted = [];

    for (const rule of rules) {
        if (!isWithinSchedule(rule)) continue;
        if (
            !matchesAudience(rule, user, {
                isApprovedPartner: partnerAccess.isApproved,
            })
        ) {
            continue;
        }
        if (!(await canGrantToUser(rule, userId))) continue;

        try {
            const result = await executeRuleGrant(rule, userId, {
                source: "RULE",
            });
            rule.grantCount = (rule.grantCount || 0) + 1;
            await rule.save();
            granted.push(result.play);
        } catch (err) {
            console.error(
                `[rewardRule] applyTrigger ${rule._id} failed:`,
                err?.message || err
            );
        }
    }

    return granted;
};

exports.getMeta = () => getRewardRuleMeta();

exports.listRules = async (query = {}) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (
        query.enabled === "true" ||
        query.enabled === true ||
        query.enabled === "1"
    ) {
        filter.enabled = true;
    } else if (
        query.enabled === "false" ||
        query.enabled === false ||
        query.enabled === "0"
    ) {
        filter.enabled = false;
    }

    if (query.trigger) filter.trigger = String(query.trigger).toUpperCase();
    if (query.audience) filter.audience = String(query.audience).toUpperCase();
    if (query.gameType) filter.gameType = String(query.gameType).toUpperCase();
    if (query.search) {
        filter.name = new RegExp(String(query.search).trim(), "i");
    }

    const [items, total] = await Promise.all([
        RewardRule.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        RewardRule.countDocuments(filter),
    ]);

    return {
        items: items.map(formatRule),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
};

exports.getRuleById = async (id) => {
    const rule = await RewardRule.findById(id);
    if (!rule) throw new ApiError(404, "Reward rule not found");
    return formatRule(rule);
};

const normalizeBody = async (body, isUpdate = false) => {
    const data = {};

    if (body.name !== undefined || !isUpdate) {
        const name = String(body.name || "").trim();
        if (!name) throw new ApiError(400, "name is required");
        data.name = name;
    }

    if (body.description !== undefined) {
        data.description = String(body.description || "").trim();
    }

    if (body.enabled !== undefined) {
        data.enabled = Boolean(body.enabled);
    }

    if (body.trigger !== undefined || !isUpdate) {
        const trigger = String(body.trigger || "").toUpperCase();
        if (!RewardRule.TRIGGERS.includes(trigger)) {
            throw new ApiError(
                400,
                `trigger must be one of: ${RewardRule.TRIGGERS.join(", ")}`
            );
        }
        data.trigger = trigger;
    }

    if (body.audience !== undefined || !isUpdate) {
        const audience = String(body.audience || "ALL").toUpperCase();
        if (!RewardRule.AUDIENCES.includes(audience)) {
            throw new ApiError(
                400,
                `audience must be one of: ${RewardRule.AUDIENCES.join(", ")}`
            );
        }
        data.audience = audience;
    }

    const audience = data.audience || body.audience || "ALL";

    if (body.userIds !== undefined || audience === "SPECIFIC") {
        const rawIds = Array.isArray(body.userIds) ? body.userIds : [];
        if (audience === "SPECIFIC") {
            if (!rawIds.length) {
                throw new ApiError(
                    400,
                    "userIds required when audience is SPECIFIC (mobile or user id)"
                );
            }
            data.userIds = await resolveUserRefs(rawIds);
        } else {
            data.userIds = [];
        }
    }

    if (body.gameType !== undefined || !isUpdate) {
        const gameType = String(body.gameType || "").toUpperCase();
        if (!RewardRule.GAME_TYPES.includes(gameType)) {
            throw new ApiError(
                400,
                "gameType must be WHEEL, SCRATCH, SHUFFLE or BUBBLE"
            );
        }
        data.gameType = gameType;
    }

    // Play-only rules — clear legacy prize fields
    data.prizeId = null;
    data.valueOverride = null;

    if (body.plays !== undefined || !isUpdate) {
        data.plays = normalizePlays(body.plays);
    }

    if (body.startAt !== undefined) {
        data.startAt = body.startAt ? new Date(body.startAt) : null;
    }
    if (body.endAt !== undefined) {
        data.endAt = body.endAt ? new Date(body.endAt) : null;
    }

    if (body.maxPerUser !== undefined) {
        data.maxPerUser =
            body.maxPerUser === null || body.maxPerUser === ""
                ? null
                : Number(body.maxPerUser);
    }
    if (body.maxTotal !== undefined) {
        data.maxTotal =
            body.maxTotal === null || body.maxTotal === ""
                ? null
                : Number(body.maxTotal);
    }

    return data;
};

exports.createRule = async (body, adminId) => {
    const data = await normalizeBody(body, false);
    data.createdBy = adminId || null;
    data.grantCount = 0;
    const rule = await RewardRule.create(data);
    return formatRule(rule);
};

exports.updateRule = async (id, body) => {
    const rule = await RewardRule.findById(id);
    if (!rule) throw new ApiError(404, "Reward rule not found");

    const merged = {
        name: body.name !== undefined ? body.name : rule.name,
        description:
            body.description !== undefined ? body.description : rule.description,
        enabled: body.enabled !== undefined ? body.enabled : rule.enabled,
        trigger: body.trigger !== undefined ? body.trigger : rule.trigger,
        audience: body.audience !== undefined ? body.audience : rule.audience,
        userIds: body.userIds !== undefined ? body.userIds : rule.userIds,
        gameType: body.gameType !== undefined ? body.gameType : rule.gameType,
        plays: body.plays !== undefined ? body.plays : rule.plays,
        startAt: body.startAt !== undefined ? body.startAt : rule.startAt,
        endAt: body.endAt !== undefined ? body.endAt : rule.endAt,
        maxPerUser:
            body.maxPerUser !== undefined ? body.maxPerUser : rule.maxPerUser,
        maxTotal: body.maxTotal !== undefined ? body.maxTotal : rule.maxTotal,
    };

    const data = await normalizeBody(merged, false);
    Object.assign(rule, data);
    await rule.save();
    return formatRule(rule);
};

exports.deleteRule = async (id) => {
    const rule = await RewardRule.findByIdAndDelete(id);
    if (!rule) throw new ApiError(404, "Reward rule not found");
    return { id };
};

/**
 * Admin manual grant:
 * - ruleId → grant that rule's game plays
 * - gameType + prizeId → instant prize (support only; no play)
 */
exports.grantManual = async ({
    userId,
    mobile,
    gameType,
    prizeId,
    valueOverride,
    ruleId,
    adminId,
}) => {
    let targetUserId = userId || null;

    if (!targetUserId && mobile) {
        const found = await User.findOne({
            mobile: String(mobile).trim(),
            isDeleted: false,
        }).select("_id");
        if (!found) {
            throw new ApiError(404, "User not found for this mobile");
        }
        targetUserId = found._id;
    }

    if (!targetUserId) {
        throw new ApiError(400, "userId or mobile is required");
    }

    const user = await User.findById(targetUserId).select("isDeleted");
    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found");
    }

    if (ruleId) {
        const rule = await RewardRule.findById(ruleId);
        if (!rule) throw new ApiError(404, "Reward rule not found");
        if (!rule.enabled) throw new ApiError(400, "Reward rule is disabled");
        if (!(await canGrantToUser(rule, targetUserId))) {
            throw new ApiError(400, "User has reached the limit for this rule");
        }
        if (rule.maxTotal != null && rule.grantCount >= rule.maxTotal) {
            throw new ApiError(400, "Reward rule total grant limit reached");
        }

        const result = await executeRuleGrant(rule, targetUserId, {
            source: "ADMIN_MANUAL",
            grantedBy: adminId || null,
        });

        rule.grantCount = (rule.grantCount || 0) + 1;
        await rule.save();
        return result.play;
    }

    if (!gameType || !prizeId) {
        throw new ApiError(
            400,
            "gameType and prizeId are required (or pass ruleId)"
        );
    }

    if (!CATALOG_GAMES.includes(String(gameType).toUpperCase())) {
        throw new ApiError(
            400,
            "Instant prize grant supports WHEEL, SCRATCH or SHUFFLE only"
        );
    }

    const prize = await exports.resolveActivePrize(gameType, prizeId);
    if (!prize) {
        throw new ApiError(400, "Selected prize not found or inactive");
    }

    // Support-only: credit prize immediately, do not grant a play
    return grantReward({
        userId: targetUserId,
        gameType,
        prize,
        valueOverride,
        source: "ADMIN_MANUAL",
        ruleId: null,
        grantedBy: adminId || null,
    });
};
