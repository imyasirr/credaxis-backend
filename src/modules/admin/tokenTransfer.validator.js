const { body, query } = require("express-validator");
const { TRANSFER_REASONS, TOKEN_TYPES } = require("../creditToken/tokenTransfer.model");

exports.createTransfer = [
    body("partnerId").notEmpty().withMessage("Partner is required"),

    body("tokenType")
        .isIn(TOKEN_TYPES)
        .withMessage("Token type must be CRIF, CIBIL or EXPERIAN"),

    body("quantity")
        .isInt({ min: 1 })
        .withMessage("Quantity must be at least 1"),

    body("reason")
        .isIn(TRANSFER_REASONS)
        .withMessage("Invalid transfer reason"),

    body("note").optional().trim().isLength({ max: 500 }),
];

exports.getTransfers = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("tokenType").optional().isIn(TOKEN_TYPES),
    query("reason").optional().isIn(TRANSFER_REASONS),
    query("status").optional().isIn(["SUCCESS", "REVERSED"]),
];
