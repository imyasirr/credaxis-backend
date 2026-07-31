const { body } = require("express-validator");

const PRIZE_TYPES = ["CASH", "TOKEN", "COUPON", "COINS", "NO_PRIZE"];

exports.createPrize = [
    body("title").trim().notEmpty().withMessage("Prize name is required"),

    body("description").optional().trim(),

    body("prizeType")
        .isIn(PRIZE_TYPES)
        .withMessage("Invalid prize type"),

    body("value")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Value must be 0 or greater"),

    body("frequency")
        .isInt({ min: 1 })
        .withMessage("Frequency must be at least 1"),

    body("color").optional().trim(),

    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage("Status must be ACTIVE or INACTIVE"),

    body("sortOrder")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Sort order must be 0 or greater"),

    body("expiryDays")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Expiry days must be 0 or greater (0 = never expires)"),
];

exports.updatePrize = [
    body("title")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Prize name cannot be empty"),

    body("description").optional().trim(),

    body("prizeType")
        .optional()
        .isIn(PRIZE_TYPES)
        .withMessage("Invalid prize type"),

    body("value")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Value must be 0 or greater"),

    body("frequency")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Frequency must be at least 1"),

    body("color").optional().trim(),

    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage("Status must be ACTIVE or INACTIVE"),

    body("sortOrder")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Sort order must be 0 or greater"),

    body("expiryDays")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Expiry days must be 0 or greater (0 = never expires)"),
];
