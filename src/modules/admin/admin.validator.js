const { body } = require("express-validator");

exports.login = [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters"),
];

exports.updateUserStatus = [
    body("status")
        .isIn(["ACTIVE", "INACTIVE", "BLOCKED", "SUSPENDED"])
        .withMessage("Invalid status"),
    body("reason")
        .optional({ values: "falsy" })
        .trim()
        .isLength({ max: 500 })
        .withMessage("Reason must be at most 500 characters"),
];

exports.updateUser = [
    body("firstName")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("First name cannot be empty"),

    body("lastName")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Last name cannot be empty"),

    body("email")
        .optional({ values: "falsy" })
        .trim()
        .isEmail()
        .withMessage("Valid email is required"),

    body("mobile")
        .optional()
        .trim()
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Valid 10-digit mobile number is required"),

    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE", "BLOCKED", "SUSPENDED"])
        .withMessage("Invalid status"),

    body("role")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["USER", "PARTNER"])
        .withMessage("Role must be USER or PARTNER"),

    body("isEmailVerified")
        .optional()
        .isBoolean()
        .withMessage("isEmailVerified must be boolean"),

    body("isMobileVerified")
        .optional()
        .isBoolean()
        .withMessage("isMobileVerified must be boolean"),

    body("gender")
        .optional({ values: "falsy" })
        .isIn(["MALE", "FEMALE", "OTHER"])
        .withMessage("Invalid gender"),

    body("dob").optional({ values: "falsy" }).isISO8601().withMessage("Invalid date of birth"),

    body("address").optional({ values: "falsy" }).trim(),
    body("city").optional({ values: "falsy" }).trim(),
    body("state").optional({ values: "falsy" }).trim(),
    body("country").optional({ values: "falsy" }).trim(),
    body("pincode")
        .optional({ values: "falsy" })
        .trim()
        .isLength({ min: 6, max: 6 })
        .withMessage("Pincode must be 6 digits"),
];
