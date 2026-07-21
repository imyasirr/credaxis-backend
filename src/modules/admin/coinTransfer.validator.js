const { body, query } = require("express-validator");
const { TRANSFER_REASONS } = require("../coins/transfer.model");

exports.createTransfer = [
    body("mobile")
        .optional()
        .trim()
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Valid 10-digit mobile number is required"),

    body("userId")
        .optional()
        .isMongoId()
        .withMessage("Invalid user ID"),

    body("amount")
        .isFloat({ min: 1 })
        .withMessage("Amount must be at least 1"),

    body("reason")
        .isIn(TRANSFER_REASONS)
        .withMessage("Invalid transfer reason"),

    body("note").optional().trim().isLength({ max: 500 }),

    body().custom((_, { req }) => {
        if (!req.body.mobile && !req.body.userId) {
            throw new Error("User ID or mobile is required");
        }
        return true;
    }),
];

exports.getTransfers = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("userId").optional().isMongoId(),
    query("reason").optional().isIn(TRANSFER_REASONS),
    query("status").optional().isIn(["SUCCESS", "REVERSED"]),
];
