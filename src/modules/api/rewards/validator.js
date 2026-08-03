const { query, param } = require("express-validator");

exports.getMyRewards = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["PENDING", "CLAIMED", "EXPIRED", "CANCELLED"]),
    query("gameType")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["WHEEL", "SCRATCH", "SHUFFLE"]),
    query("prizeType")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["CASH", "TOKEN", "COUPON", "COINS", "NO_PRIZE"]),
    query("usable").optional().isIn(["true", "false", "1", "0"]),
];

exports.rewardId = [
    param("id").isMongoId().withMessage("Invalid reward id"),
];
