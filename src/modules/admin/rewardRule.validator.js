const { body, param, query } = require("express-validator");
const { TRIGGERS, AUDIENCES, GAME_TYPES } = require("../rewards/rewardRule.model");

exports.listRules = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("enabled").optional().isIn(["true", "false", "1", "0"]),
    query("trigger").optional().isIn(TRIGGERS),
    query("audience").optional().isIn(AUDIENCES),
    query("gameType").optional().isIn(GAME_TYPES),
    query("search").optional().trim(),
];

exports.ruleId = [
    param("id").isMongoId().withMessage("Invalid rule id"),
];

exports.createRule = [
    body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 100 }),
    body("description").optional().trim().isLength({ max: 500 }),
    body("enabled").optional().isBoolean(),
    body("trigger")
        .notEmpty()
        .isIn(TRIGGERS)
        .withMessage(`trigger must be one of: ${TRIGGERS.join(", ")}`),
    body("audience")
        .optional()
        .isIn(AUDIENCES)
        .withMessage(`audience must be one of: ${AUDIENCES.join(", ")}`),
    body("userIds").optional().isArray(),
    body("userIds.*")
        .optional()
        .isString()
        .withMessage("userIds must be mobiles or user ids"),
    body("gameType")
        .notEmpty()
        .isIn(GAME_TYPES)
        .withMessage("gameType must be WHEEL, SCRATCH or SHUFFLE"),
    body("prizeId").notEmpty().isMongoId().withMessage("prizeId is required"),
    body("valueOverride")
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage("valueOverride must be >= 0"),
    body("startAt").optional({ nullable: true }).isISO8601(),
    body("endAt").optional({ nullable: true }).isISO8601(),
    body("maxPerUser").optional({ nullable: true }).isInt({ min: 0 }),
    body("maxTotal").optional({ nullable: true }).isInt({ min: 0 }),
];

exports.updateRule = [
    param("id").isMongoId().withMessage("Invalid rule id"),
    body("name").optional().trim().notEmpty().isLength({ max: 100 }),
    body("description").optional().trim().isLength({ max: 500 }),
    body("enabled").optional().isBoolean(),
    body("trigger").optional().isIn(TRIGGERS),
    body("audience").optional().isIn(AUDIENCES),
    body("userIds").optional().isArray(),
    body("userIds.*")
        .optional()
        .isString()
        .withMessage("userIds must be mobiles or user ids"),
    body("gameType").optional().isIn(GAME_TYPES),
    body("prizeId").optional().isMongoId(),
    body("valueOverride").optional({ nullable: true }).isFloat({ min: 0 }),
    body("startAt").optional({ nullable: true }).isISO8601(),
    body("endAt").optional({ nullable: true }).isISO8601(),
    body("maxPerUser").optional({ nullable: true }).isInt({ min: 0 }),
    body("maxTotal").optional({ nullable: true }).isInt({ min: 0 }),
];

exports.grantManual = [
    body("userId").optional().isMongoId().withMessage("Invalid userId"),
    body("mobile")
        .optional()
        .trim()
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Valid 10-digit mobile is required"),
    body("ruleId").optional().isMongoId(),
    body("gameType").optional().isIn(GAME_TYPES),
    body("prizeId").optional().isMongoId(),
    body("valueOverride").optional({ nullable: true }).isFloat({ min: 0 }),
    body().custom((_, { req }) => {
        if (!req.body.userId && !req.body.mobile) {
            throw new Error("userId or mobile is required");
        }
        if (!req.body.ruleId && !(req.body.gameType && req.body.prizeId)) {
            throw new Error("ruleId or (gameType + prizeId) is required");
        }
        return true;
    }),
];
