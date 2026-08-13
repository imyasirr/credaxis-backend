const { body, param, query } = require("express-validator");
const {
    WITHDRAWAL_STATUSES,
} = require("../../api/wallet/withdrawalRequest.model");

exports.list = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(Object.values(WITHDRAWAL_STATUSES)),
    query("userId").optional().isMongoId(),
    query("search").optional().trim().isLength({ max: 100 }),
];

exports.withdrawalId = [
    param("id").isMongoId().withMessage("Invalid withdrawal id"),
];

exports.initiate = [
    body("expectedAt").optional().isISO8601(),
    body("adminRemark").optional().trim().isLength({ max: 500 }),
];

exports.markSuccess = [
    body("providerPayoutId").optional().trim().isLength({ max: 100 }),
    body("providerStatus").optional().trim().isLength({ max: 50 }),
    body("description").optional().trim().isLength({ max: 200 }),
    body("adminRemark").optional().trim().isLength({ max: 500 }),
];

exports.rejectOrFail = [
    body("reason")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("reason must be at most 500 characters"),
    body("adminRemark").optional().trim().isLength({ max: 500 }),
];

exports.updateExpected = [
    body("expectedAt")
        .notEmpty()
        .withMessage("expectedAt is required")
        .bail()
        .isISO8601()
        .withMessage("expectedAt must be ISO date"),
    body("adminRemark").optional().trim().isLength({ max: 500 }),
];
