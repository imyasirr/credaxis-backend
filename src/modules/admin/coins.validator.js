const { body } = require("express-validator");

exports.createCoinWallet = [
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

exports.updateCoinWallet = [
    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE", "BLOCKED"])
        .withMessage("Invalid coin account status"),
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
