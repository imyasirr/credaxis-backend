const { body } = require("express-validator");

exports.submit = [
    body("account_holder_name")
        .optional()
        .customSanitizer((value, { req }) => {
            if (req.body.accountHolderName === undefined) {
                req.body.accountHolderName = value;
            }
            return value;
        }),
    body("bank_name")
        .optional()
        .customSanitizer((value, { req }) => {
            if (req.body.bankName === undefined) {
                req.body.bankName = value;
            }
            return value;
        }),
    body("account_number")
        .optional()
        .customSanitizer((value, { req }) => {
            if (req.body.accountNumber === undefined) {
                req.body.accountNumber = value;
            }
            return value;
        }),
    body("ifsc")
        .optional()
        .customSanitizer((value, { req }) => {
            if (req.body.ifscCode === undefined) {
                req.body.ifscCode = value;
            }
            return value;
        }),
    body("ifsc_code")
        .optional()
        .customSanitizer((value, { req }) => {
            if (req.body.ifscCode === undefined) {
                req.body.ifscCode = value;
            }
            return value;
        }),
    body("account_type")
        .optional()
        .customSanitizer((value, { req }) => {
            if (req.body.accountType === undefined) {
                req.body.accountType = value;
            }
            return value;
        }),

    body("panNumber")
        .notEmpty()
        .withMessage("PAN number is required")
        .trim()
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
        .withMessage("Invalid PAN format"),

    body("aadhaarNumber")
        .notEmpty()
        .withMessage("Aadhaar number is required")
        .trim()
        .isLength({ min: 12, max: 12 })
        .withMessage("Aadhaar must be 12 digits"),

    body("accountHolderName")
        .notEmpty()
        .withMessage("Account holder name is required")
        .trim()
        .isLength({ max: 200 }),

    body("bankName")
        .notEmpty()
        .withMessage("Bank name is required")
        .trim()
        .isLength({ max: 200 }),

    body("accountNumber")
        .notEmpty()
        .withMessage("Account number is required")
        .trim(),

    body("ifscCode")
        .notEmpty()
        .withMessage("IFSC code is required")
        .trim()
        .isLength({ min: 11, max: 11 })
        .withMessage("IFSC code must be 11 characters"),

    body("accountType")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["SAVING", "SAVINGS", "CURRENT"])
        .withMessage("accountType must be SAVING or CURRENT"),
];

exports.reject = [
    body("remarks")
        .notEmpty()
        .withMessage("Rejection remarks are required")
        .trim()
        .isLength({ max: 300 }),
];
