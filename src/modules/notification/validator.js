const { query, param } = require("express-validator");

exports.getMyNotifications = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("isRead")
        .optional()
        .isIn(["true", "false", "1", "0"])
        .withMessage("isRead must be true or false"),
    query("type")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["INFO", "SUCCESS", "WARNING", "ERROR"])
        .withMessage("Invalid notification type"),
];

exports.notificationId = [
    param("id").isMongoId().withMessage("Invalid notification id"),
];
