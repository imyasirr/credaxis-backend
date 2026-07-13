const { body } = require("express-validator");

exports.mobileAuth = [
    body("mobile")
        .isLength({ min: 10, max: 10 })
        .withMessage("Mobile must be 10 digits")
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Enter a valid Indian mobile number"),
];

exports.verifyOtp = [
    body("mobile")
        .isLength({ min: 10, max: 10 })
        .withMessage("Mobile must be 10 digits"),

    body("otp")
        .isLength({ min: 6, max: 6 })
        .withMessage("OTP must be 6 digits"),

    body("partnerCode")
        .optional()
        .trim()
        .isLength({ min: 6, max: 20 })
        .withMessage("Invalid partner code"),
];
