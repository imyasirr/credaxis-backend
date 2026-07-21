const { body } = require("express-validator");

exports.submit = [
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
];

exports.reject = [
    body("remarks")
        .notEmpty()
        .withMessage("Rejection remarks are required")
        .trim()
        .isLength({ max: 300 }),
];
