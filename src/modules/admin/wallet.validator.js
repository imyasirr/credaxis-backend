const { body } = require("express-validator");

exports.createWallet = [
    body("mobile")
        .optional()
        .trim()
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Valid 10-digit mobile number is required"),

    body("userId")
        .optional()
        .isMongoId()
        .withMessage("Invalid user ID"),

    body("initialBalance")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Initial balance must be 0 or greater"),

    body().custom((_, { req }) => {
        if (!req.body.mobile && !req.body.userId) {
            throw new Error("User ID or mobile is required");
        }
        return true;
    }),
];

exports.updateWallet = [
    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE", "BLOCKED"])
        .withMessage("Invalid wallet status"),

    body("isKycCompleted")
        .optional()
        .isBoolean()
        .withMessage("isKycCompleted must be boolean"),

    body("dailyLimit")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Daily limit must be 0 or greater"),

    body("monthlyLimit")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Monthly limit must be 0 or greater"),

    body("currency")
        .optional()
        .trim()
        .isLength({ min: 3, max: 3 })
        .withMessage("Currency must be a 3-letter code"),

    body("holdBalance")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Hold balance must be 0 or greater"),
];

exports.adjustBalance = [
    body("type")
        .isIn(["CREDIT", "DEBIT"])
        .withMessage("Type must be CREDIT or DEBIT"),

    body("amount")
        .isFloat({ gt: 0 })
        .withMessage("Amount must be greater than 0"),

    body("description").optional().trim(),
];
