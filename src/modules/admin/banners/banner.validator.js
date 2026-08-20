const { body, param, query } = require("express-validator");

const isValidLink = (value) => {
    if (!value) return true;
    if (value.startsWith("/")) return true;
    if (!/^https?:\/\//i.test(value)) {
        throw new Error(
            "Link must be a valid URL (https://...) or an app path (/wallet)"
        );
    }
    try {
        return Boolean(new URL(value));
    } catch {
        throw new Error("Invalid URL");
    }
};

exports.listBanners = [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page"),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
    query("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage("Status must be ACTIVE or INACTIVE"),
    query("search").optional().trim(),
    query("sortBy")
        .optional()
        .isIn([
            "title",
            "status",
            "sortOrder",
            "clickCount",
            "createdAt",
            "updatedAt",
        ]),
    query("sortOrder").optional().isIn(["asc", "desc"]),
];

exports.bannerId = [
    param("id").isMongoId().withMessage("Invalid banner id"),
];

exports.listClicks = [
    param("id").isMongoId().withMessage("Invalid banner id"),
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page"),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
    query("search").optional().trim(),
    query("source")
        .optional()
        .isIn(["APP", "ADMIN", "ANONYMOUS"])
        .withMessage("Source must be APP, ADMIN or ANONYMOUS"),
];

exports.createBanner = [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ max: 120 })
        .withMessage("Title must be 120 characters or less"),

    body("description")
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description must be 500 characters or less"),

    body("link").optional({ checkFalsy: true }).trim().custom(isValidLink),

    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage("Status must be ACTIVE or INACTIVE"),

    body("sortOrder")
        .optional({ checkFalsy: true })
        .isInt({ min: 0 })
        .withMessage("Sort order must be 0 or greater"),
];

exports.updateBanner = [
    param("id").isMongoId().withMessage("Invalid banner id"),

    body("title")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Title cannot be empty")
        .isLength({ max: 120 })
        .withMessage("Title must be 120 characters or less"),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description must be 500 characters or less"),

    body("link").optional().trim().custom(isValidLink),

    body("status")
        .optional()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage("Status must be ACTIVE or INACTIVE"),

    body("sortOrder")
        .optional({ checkFalsy: true })
        .isInt({ min: 0 })
        .withMessage("Sort order must be 0 or greater"),
];
