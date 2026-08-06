const { query } = require("express-validator");
const { TOKEN_TYPES } = require("../../api/creditToken/constants");

exports.getTokenPurchases = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("tokenType")
        .optional()
        .isIn(TOKEN_TYPES)
        .withMessage("Token type must be EQUIFAX"),
    query("status")
        .optional()
        .isIn(["PENDING", "SUCCESS", "FAILED", "REFUNDED"])
        .withMessage("Invalid status"),
];
