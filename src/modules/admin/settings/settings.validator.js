const { body } = require("express-validator");

exports.updateCreditCheckFee = [
    body("amount")
        .optional()
        .isFloat({ min: 1 })
        .withMessage("Amount must be at least ₹1"),
    body("currency").optional().trim().isIn(["INR"]),
    body("enabled").optional().isBoolean(),
];

exports.updateFirstTopupBonus = [
    body("minAmount")
        .optional()
        .isFloat({ min: 1 })
        .withMessage("Minimum amount must be at least ₹1"),
    body("enabled").optional().isBoolean(),
];
