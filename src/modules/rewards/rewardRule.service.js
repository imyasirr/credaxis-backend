const mongoose = require("mongoose");
const RewardRule = require("./rewardRule.model");
const WheelPrize = require("./wheelPrize.model");
const ScratchPrize = require("./scratchPrize.model");
const ShufflePrize = require("./shufflePrize.model");
const UserReward = require("./model");
const User = require("../user/model");
const { grantReward } = require("./service");
const {
    formatRewardRule,
    getRewardRuleMeta,
} = require("./rewardRule.mapper");
const ApiError = require("../../utils/ApiError");

const PRIZE_MODELS = {
    WHEEL: WheelPrize,
    SCRATCH: ScratchPrize,
    SHUFFLE: ShufflePrize,
};

const getPrizeModel = (gameType) => {
    const model = PRIZE_MODELS[String(gameType || "").toUpperCase()];
    if (!model) {
        throw new ApiError(400, "gameType must be WHEEL, SCRATCH or SHUFFLE");
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

const attachPrize = async (rule) => {
    const formatted = formatRewardRule(rule);
    const prize = await getPrizeModel(rule.gameType)
        .findById(rule.prizeId)
        .lean();
    if (prize) {
        formatted.prize = {
            id: prize._id,
            title: prize.title,
            prizeType: prize.prizeType,
            value: prize.value,
            status: prize.status,
            color: prize.color,
            expiryDays: prize.expiryDays,
        };
    }
    return formatted;
};

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
    // Approved partners keep role USER — still eligible for USER audience rewards
    if (audience === "USER") {
        return roleName === "USER" || roleName === "PARTNER";
    }
    // Partner audience = approved Partner application (not just role name)
    if (audience === "PARTNER") {
        return isApprovedPartner || roleName === "PARTNER";
    }

    if (audience === "SPECIFIC") {
        const ids = (rule.userIds || []).map((id) => id.toString());
        return ids.includes(user._id.toString());
    }
    return false;
};

const canGrantToUser = async (rule, userId) => {
    if (rule.maxTotal != null && rule.grantCount >= rule.maxTotal) {
        return false;
    }

    if (rule.maxPerUser == null) return true;
    if (rule.maxPerUser <= 0) return false;

    const count = await UserReward.countDocuments({
        user: userId,
        ruleId: rule._id,
    });
    return count < rule.maxPerUser;
};

/**
 * Apply all enabled rules for a trigger to one user.
 * Returns list of granted rewards (may be empty).
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

        const prize = await exports.resolveActivePrize(
            rule.gameType,
            rule.prizeId
        );
        if (!prize) continue;

        const reward = await grantReward({
            userId,
            gameType: rule.gameType,
            prize,
            valueOverride: rule.valueOverride,
            source: "RULE",
            ruleId: rule._id,
        });

        rule.grantCount = (rule.grantCount || 0) + 1;
        await rule.save();

        granted.push(reward);
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

    const rules = await Promise.all(items.map((item) => attachPrize(item)));

    return {
        items: rules,
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
    return attachPrize(rule);
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
            throw new ApiError(400, "gameType must be WHEEL, SCRATCH or SHUFFLE");
        }
        data.gameType = gameType;
    }

    if (body.prizeId !== undefined || !isUpdate) {
        if (!body.prizeId) throw new ApiError(400, "prizeId is required");
        data.prizeId = body.prizeId;
    }

    if (body.valueOverride !== undefined) {
        data.valueOverride =
            body.valueOverride === null || body.valueOverride === ""
                ? null
                : Number(body.valueOverride);
        if (
            data.valueOverride != null &&
            (Number.isNaN(data.valueOverride) || data.valueOverride < 0)
        ) {
            throw new ApiError(400, "valueOverride must be a number >= 0");
        }
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

    const gameType = data.gameType;
    const prizeId = data.prizeId;
    if (gameType && prizeId) {
        const prize = await exports.resolveActivePrize(gameType, prizeId);
        if (!prize) {
            throw new ApiError(400, "Selected prize not found or inactive");
        }
    }

    return data;
};

exports.createRule = async (body, adminId) => {
    const data = await normalizeBody(body, false);
    data.createdBy = adminId || null;
    data.grantCount = 0;
    const rule = await RewardRule.create(data);
    return attachPrize(rule);
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
        prizeId: body.prizeId !== undefined ? body.prizeId : rule.prizeId,
        valueOverride:
            body.valueOverride !== undefined
                ? body.valueOverride
                : rule.valueOverride,
        startAt: body.startAt !== undefined ? body.startAt : rule.startAt,
        endAt: body.endAt !== undefined ? body.endAt : rule.endAt,
        maxPerUser:
            body.maxPerUser !== undefined ? body.maxPerUser : rule.maxPerUser,
        maxTotal: body.maxTotal !== undefined ? body.maxTotal : rule.maxTotal,
    };

    const data = await normalizeBody(merged, false);
    Object.assign(rule, data);
    await rule.save();
    return attachPrize(rule);
};

exports.deleteRule = async (id) => {
    const rule = await RewardRule.findByIdAndDelete(id);
    if (!rule) throw new ApiError(404, "Reward rule not found");
    return { id };
};

/**
 * Admin manual grant — by userId or mobile, optional ruleId or free-form prize.
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

        const prize = await exports.resolveActivePrize(
            rule.gameType,
            rule.prizeId
        );
        if (!prize) {
            throw new ApiError(400, "Rule prize not found or inactive");
        }

        const resolvedOverride =
            valueOverride !== undefined && valueOverride !== null
                ? valueOverride
                : rule.valueOverride;

        const reward = await grantReward({
            userId: targetUserId,
            gameType: rule.gameType,
            prize,
            valueOverride: resolvedOverride,
            source: "ADMIN_MANUAL",
            ruleId: rule._id,
            grantedBy: adminId || null,
        });

        rule.grantCount = (rule.grantCount || 0) + 1;
        await rule.save();
        return reward;
    }

    if (!gameType || !prizeId) {
        throw new ApiError(
            400,
            "gameType and prizeId are required (or pass ruleId)"
        );
    }

    const prize = await exports.resolveActivePrize(gameType, prizeId);
    if (!prize) {
        throw new ApiError(400, "Selected prize not found or inactive");
    }

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
