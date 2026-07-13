const { body, param } = require("express-validator");

const partnerFields = [
    body("businessName")
        .trim()
        .notEmpty()
        .withMessage("Business name is required"),

    body("businessType")
        .trim()
        .toUpperCase()
        .notEmpty()
        .withMessage("Business type is required")
        .isIn(["INDIVIDUAL", "SHOP", "DISTRIBUTOR", "AGENCY"])
        .withMessage("Invalid business type"),

    body("ownerName")
        .trim()
        .notEmpty()
        .withMessage("Owner name is required"),

    body("email")
        .optional({ values: "falsy" })
        .trim()
        .isEmail()
        .withMessage("Valid email required"),

    body("panNumber")
        .trim()
        .toUpperCase()
        .notEmpty()
        .withMessage("PAN number is required")
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
        .withMessage("Invalid PAN format"),

    body("gstNumber")
        .optional({ values: "falsy" })
        .trim()
        .toUpperCase()
        .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
        .withMessage("Invalid GST format"),

    body("address")
        .trim()
        .notEmpty()
        .withMessage("Address is required"),

    body("city")
        .trim()
        .notEmpty()
        .withMessage("City is required"),

    body("state")
        .trim()
        .notEmpty()
        .withMessage("State is required"),

    body("pincode")
        .trim()
        .notEmpty()
        .withMessage("Pincode is required")
        .isLength({ min: 6, max: 6 })
        .withMessage("Pincode must be 6 digits"),

    body("country").optional({ values: "falsy" }).trim(),
];

exports.apply = partnerFields;

exports.update = partnerFields;

exports.reject = [
    body("remarks")
        .trim()
        .notEmpty()
        .withMessage("Rejection remarks are required")
        .isLength({ max: 300 }),
];

exports.validateCode = [
    param("code")
        .trim()
        .toUpperCase()
        .notEmpty()
        .withMessage("Partner code is required")
        .isLength({ min: 6, max: 20 })
        .withMessage("Invalid partner code"),
];

exports.approve = [
    body("commissionRate")
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage("Commission rate must be between 0 and 100"),
];
