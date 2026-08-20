const { body, query } = require("express-validator");

exports.complete = [
    body("firstName")
        .notEmpty()
        .withMessage("First name is required")
        .trim()
        .isLength({ min: 2, max: 50 }),

    body("email")
        .notEmpty()
        .withMessage("Email is required")
        .bail()
        .trim()
        .isEmail()
        .withMessage("Valid email is required")
        .normalizeEmail(),

    body("lastName").optional().trim().isLength({ max: 50 }),

    body("gender").optional().isIn(["MALE", "FEMALE", "OTHER"]),

    body("dob").optional().isISO8601(),

    body("address").optional().trim().isLength({ max: 200 }),

    body("city").optional().trim().isLength({ max: 50 }),

    body("state").optional().trim().isLength({ max: 50 }),

    body("country").optional().trim().isLength({ max: 50 }),

    body("pincode")
        .optional()
        .trim()
        .isLength({ min: 6, max: 6 })
        .withMessage("Pincode must be 6 digits"),
];

exports.update = [
    body("firstName").optional().trim().isLength({ min: 2, max: 50 }),

    body("email")
        .optional({ values: "falsy" })
        .trim()
        .isEmail()
        .withMessage("Valid email is required")
        .normalizeEmail(),

    body("lastName").optional().trim().isLength({ max: 50 }),

    body("gender").optional().isIn(["MALE", "FEMALE", "OTHER"]),

    body("dob").optional().isISO8601(),

    body("address").optional().trim().isLength({ max: 200 }),

    body("city").optional().trim().isLength({ max: 50 }),

    body("state").optional().trim().isLength({ max: 50 }),

    body("country").optional().trim().isLength({ max: 50 }),

    body("pincode")
        .optional()
        .trim()
        .isLength({ min: 6, max: 6 })
        .withMessage("Pincode must be 6 digits"),
];

exports.getReferrals = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("source")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["USER", "PARTNER"])
        .withMessage("source must be USER or PARTNER"),
];

exports.requestDeletion = [
    body("reason")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("reason must be at most 500 characters"),
];

exports.setMandateStory = [
    body("activated")
        .exists()
        .withMessage("activated is required")
        .bail()
        .isBoolean()
        .withMessage("activated must be true or false")
        .toBoolean(),
];

exports.setDlcStory = [
    body("activated")
        .exists()
        .withMessage("activated is required")
        .bail()
        .isBoolean()
        .withMessage("activated must be true or false")
        .toBoolean(),
];
