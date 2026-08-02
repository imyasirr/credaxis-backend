const { body, param, query } = require("express-validator");

exports.createPage = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Page name is required"),

    body("slug")
        .trim()
        .notEmpty()
        .withMessage("Page slug is required")
        .matches(/^[a-z0-9-]+$/)
        .withMessage("Slug can only contain lowercase letters, numbers, and hyphens"),

    body("description").optional().trim(),

    body("sections").optional().isArray().withMessage("Sections must be an array"),

    body("seo.metaTitle").optional().trim(),
    body("seo.metaDescription").optional().trim(),
    body("seo.keywords").optional().isArray(),
    body("seo.ogImage").optional().trim(),

    body("isPublished")
        .optional()
        .isBoolean()
        .withMessage("isPublished must be a boolean"),
];

exports.updatePage = [
    param("id").isMongoId().withMessage("Invalid page ID"),

    body("name").optional().trim().notEmpty().withMessage("Page name cannot be empty"),

    body("slug")
        .optional()
        .trim()
        .matches(/^[a-z0-9-]+$/)
        .withMessage("Slug can only contain lowercase letters, numbers, and hyphens"),

    body("description").optional().trim(),

    body("sections").optional().isArray().withMessage("Sections must be an array"),

    body("seo.metaTitle").optional().trim(),
    body("seo.metaDescription").optional().trim(),
    body("seo.keywords").optional().isArray(),
    body("seo.ogImage").optional().trim(),

    body("isPublished")
        .optional()
        .isBoolean()
        .withMessage("isPublished must be a boolean"),

    body("status")
        .optional()
        .isBoolean()
        .withMessage("status must be a boolean"),
];

exports.pageIdParam = [
    param("id").isMongoId().withMessage("Invalid page ID"),
];

exports.upsertSection = [
    param("id").isMongoId().withMessage("Invalid page ID"),

    body("key")
        .trim()
        .notEmpty()
        .withMessage("Section key is required"),

    body("title").optional().trim(),
    body("subtitle").optional().trim(),
    body("description").optional().trim(),
    body("image").optional().trim(),
    body("backgroundImage").optional().trim(),
    body("buttons").optional().isArray(),
    body("items").optional(),
    body("settings").optional(),
    body("order").optional().isNumeric().withMessage("Order must be a number"),
    body("status").optional().isBoolean(),
];

exports.deleteSection = [
    param("id").isMongoId().withMessage("Invalid page ID"),
    param("sectionKey").trim().notEmpty().withMessage("Section key is required"),
];

exports.reorderSections = [
    param("id").isMongoId().withMessage("Invalid page ID"),
    body("sectionOrders")
        .isArray({ min: 1 })
        .withMessage("sectionOrders must be a non-empty array of { key, order }"),
];

exports.mediaIdParam = [
    param("id").isMongoId().withMessage("Invalid media ID"),
];
