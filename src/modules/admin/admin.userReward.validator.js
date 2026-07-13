const { body, query } = require("express-validator");

exports.getUserRewards = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("gameType")
        .optional()
        .isIn(["WHEEL", "SCRATCH", "SHUFFLE"])
        .withMessage("Invalid game type"),
    query("prizeType")
        .optional()
        .isIn(["CASH", "TOKEN", "COUPON", "NO_PRIZE"])
        .withMessage("Invalid prize type"),
    query("status")
        .optional()
        .isIn(["PENDING", "CLAIMED", "EXPIRED", "CANCELLED"])
        .withMessage("Invalid status"),
];

exports.updateUserRewardStatus = [
    body("status")
        .isIn(["PENDING", "CLAIMED", "EXPIRED", "CANCELLED"])
        .withMessage("Invalid status"),
];
