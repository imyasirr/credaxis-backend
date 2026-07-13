const { body } = require("express-validator");

exports.addMoney = [
    body("amount")
        .isFloat({ min: 1 })
        .withMessage("Amount must be at least ₹1"),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 200 }),
];

exports.beneficiary = [
    body("beneficiaryName")
        .notEmpty()
        .withMessage("Beneficiary name is required")
        .trim(),

    body("bankName")
        .notEmpty()
        .withMessage("Bank name is required")
        .trim(),

    body("accountNumber")
        .notEmpty()
        .withMessage("Account number is required")
        .trim(),

    body("ifscCode")
        .notEmpty()
        .withMessage("IFSC code is required")
        .trim()
        .isLength({ min: 11, max: 11 })
        .withMessage("IFSC must be 11 characters"),

    body("mobile")
        .optional()
        .isLength({ min: 10, max: 10 }),

    body("nickname").optional().trim().isLength({ max: 50 }),
];

exports.updateBeneficiary = [
    body("beneficiaryName").optional().trim().notEmpty(),
    body("bankName").optional().trim().notEmpty(),
    body("accountNumber").optional().trim().notEmpty(),
    body("ifscCode").optional().trim().isLength({ min: 11, max: 11 }),
    body("mobile").optional().isLength({ min: 10, max: 10 }),
    body("nickname").optional().trim().isLength({ max: 50 }),
];
