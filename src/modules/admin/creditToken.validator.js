const { body } = require("express-validator");

const TOKEN_TYPES = ["CRIF", "CIBIL", "EXPERIAN"];

const PLAN_TYPES = ["NORMAL", "POPULAR"];

exports.createToken = [
    body("title").trim().notEmpty().withMessage("Plan name is required"),

    body("description").optional().trim(),

    body("tokenType")
        .isIn(TOKEN_TYPES)
        .withMessage("Invalid token type"),

    body("planType")
        .optional()
        .isIn(PLAN_TYPES)
        .withMessage("Invalid plan type"),

    body("badge").optional().trim(),

    body("price")
        .isFloat({ min: 0 })
        .withMessage("Price must be 0 or greater"),

    body("quantity")
        .isInt({ min: 1 })
        .withMessage("Quantity must be at least 1"),

    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage("Status must be ACTIVE or INACTIVE"),

    body("sortOrder")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Sort order must be 0 or greater"),
];

exports.updateToken = [
    body("title")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Plan name cannot be empty"),

    body("description").optional().trim(),

    body("tokenType")
        .optional()
        .isIn(TOKEN_TYPES)
        .withMessage("Invalid token type"),

    body("planType")
        .optional()
        .isIn(PLAN_TYPES)
        .withMessage("Invalid plan type"),

    body("badge").optional().trim(),

    body("price")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Price must be 0 or greater"),

    body("quantity")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Quantity must be at least 1"),

    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage("Status must be ACTIVE or INACTIVE"),

    body("sortOrder")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Sort order must be 0 or greater"),
];
