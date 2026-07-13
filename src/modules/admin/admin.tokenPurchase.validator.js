const { query } = require("express-validator");

exports.getTokenPurchases = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("tokenType")
        .optional()
        .isIn(["CRIF", "CIBIL", "EXPERIAN"])
        .withMessage("Invalid token type"),
    query("status")
        .optional()
        .isIn(["PENDING", "SUCCESS", "FAILED", "REFUNDED"])
        .withMessage("Invalid status"),
];
