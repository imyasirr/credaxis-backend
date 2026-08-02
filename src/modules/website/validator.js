const { param } = require("express-validator");

exports.getBySlug = [
    param("slug")
        .trim()
        .notEmpty()
        .withMessage("Slug is required")
        .toLowerCase(),
];

exports.getSection = [
    param("slug")
        .trim()
        .notEmpty()
        .withMessage("Slug is required")
        .toLowerCase(),
    param("sectionKey")
        .trim()
        .notEmpty()
        .withMessage("Section key is required"),
];
