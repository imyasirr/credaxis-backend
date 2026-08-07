const { body } = require("express-validator");

exports.updateCreditCheckFee = [
    body("amount")
        .optional()
        .isFloat({ min: 1 })
        .withMessage("Amount must be at least ₹1"),
    body("currency").optional().trim().isIn(["INR"]),
    body("enabled").optional().isBoolean(),
    body("coinConversion").optional().isObject(),
    body("coinConversion.coins")
        .optional()
        .isFloat({ min: 1 })
        .withMessage("coinConversion.coins must be at least 1"),
    body("coinConversion.rupees")
        .optional()
        .isFloat({ gt: 0 })
        .withMessage("coinConversion.rupees must be greater than 0"),
    body("coins")
        .optional()
        .isFloat({ min: 1 })
        .withMessage("coins must be at least 1"),
    body("rupees")
        .optional()
        .isFloat({ gt: 0 })
        .withMessage("rupees must be greater than 0"),
];

/** Same shape as credit-check fee */
exports.updateMandateCreateFee = exports.updateCreditCheckFee;

exports.updateFirstTopupBonus = [
    body("minAmount")
        .optional()
        .isFloat({ min: 1 })
        .withMessage("Minimum amount must be at least ₹1"),
    body("enabled").optional().isBoolean(),
];
