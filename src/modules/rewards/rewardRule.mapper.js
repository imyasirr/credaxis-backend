const { TRIGGERS, AUDIENCES, GAME_TYPES } = require("./rewardRule.model");

const TRIGGER_META = {
    REFERRAL_REFERRER: {
        label: "Referral — Referrer",
        help: "When someone uses this user's referral code",
    },
    REFERRAL_REFEREE: {
        label: "Referral — New user",
        help: "When a new user signs up with a referral code",
    },
    USER_SIGNUP: {
        label: "User signup",
        help: "When a new user completes registration",
    },
    KYC_APPROVED: {
        label: "KYC approved",
        help: "When the user's KYC is approved by admin",
    },
    MANUAL: {
        label: "Manual only",
        help: "Not auto-triggered — use Grant from Reward Management",
    },
};

const AUDIENCE_META = {
    ALL: { label: "All users", help: "Anyone who hits the trigger" },
    USER: { label: "App users only", help: "Role = USER" },
    PARTNER: {
        label: "Approved partners only",
        help: "Users with Partner.status = APPROVED (role stays USER)",
    },
    SPECIFIC: {
        label: "Specific users",
        help: "Only selected user IDs / mobiles",
    },
};

exports.formatRewardRule = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;

    return {
        id: data._id,
        name: data.name,
        description: data.description || "",
        enabled: Boolean(data.enabled),
        trigger: data.trigger,
        triggerLabel: TRIGGER_META[data.trigger]?.label || data.trigger,
        audience: data.audience || "ALL",
        audienceLabel: AUDIENCE_META[data.audience]?.label || data.audience,
        userIds: (data.userIds || []).map((id) => id?.toString?.() || id),
        gameType: data.gameType,
        prizeId: data.prizeId?.toString?.() || data.prizeId,
        prize: data.prize || null,
        valueOverride:
            data.valueOverride === undefined || data.valueOverride === null
                ? null
                : Number(data.valueOverride),
        startAt: data.startAt || null,
        endAt: data.endAt || null,
        maxPerUser:
            data.maxPerUser === undefined || data.maxPerUser === null
                ? null
                : Number(data.maxPerUser),
        maxTotal:
            data.maxTotal === undefined || data.maxTotal === null
                ? null
                : Number(data.maxTotal),
        grantCount: Number(data.grantCount) || 0,
        createdBy: data.createdBy || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.getRewardRuleMeta = () => ({
    triggers: TRIGGERS.map((key) => ({
        value: key,
        label: TRIGGER_META[key].label,
        help: TRIGGER_META[key].help,
    })),
    audiences: AUDIENCES.map((key) => ({
        value: key,
        label: AUDIENCE_META[key].label,
        help: AUDIENCE_META[key].help,
    })),
    gameTypes: GAME_TYPES.map((value) => ({
        value,
        label:
            value === "WHEEL"
                ? "Spin Wheel"
                : value === "SCRATCH"
                  ? "Scratch Card"
                  : "Card Shuffle",
    })),
});
