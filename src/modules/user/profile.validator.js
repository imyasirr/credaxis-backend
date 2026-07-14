const { body, query } = require("express-validator");

exports.complete = [
    body("firstName")
        .notEmpty()
        .withMessage("First name is required")
        .trim()
        .isLength({ min: 2, max: 50 }),

    body("lastName")
        .optional()
        .trim()
        .isLength({ max: 50 }),

    body("gender")
        .optional()
        .isIn(["MALE", "FEMALE", "OTHER"]),

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
    body("firstName")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }),

    body("lastName")
        .optional()
        .trim()
        .isLength({ max: 50 }),

    body("gender")
        .optional()
        .isIn(["MALE", "FEMALE", "OTHER"]),

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
];
