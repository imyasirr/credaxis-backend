const { body, query } = require("express-validator");

const GAME_TYPES = ["WHEEL", "SCRATCH", "SHUFFLE"];

const rewardSide = (prefix) => [
    body(`${prefix}.enabled`).optional().isBoolean(),
    body(`${prefix}.gameType`)
        .optional()
        .trim()
        .toUpperCase()
        .isIn(GAME_TYPES)
        .withMessage(`${prefix}.gameType must be WHEEL, SCRATCH or SHUFFLE`),
    body(`${prefix}.prizeId`)
        .optional({ nullable: true })
        .custom((value) => value === null || value === "" || /^[a-f\d]{24}$/i.test(String(value)))
        .withMessage(`${prefix}.prizeId must be a valid id or null`),
];

exports.updateUserReferralSetting = [
    body("enabled").optional().isBoolean(),
    ...rewardSide("referrerReward"),
    ...rewardSide("refereeReward"),
];

exports.getUserReferrals = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().isIn(["REGISTERED", "ACTIVE"]),
    query("referrerId").optional().isMongoId(),
];
