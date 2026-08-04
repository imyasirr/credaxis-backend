const { query, param } = require("express-validator");
const {
    PAYMENT_PURPOSES,
    PAYMENT_STATUSES,
} = require("../../../integrations/razorpay/constants");

exports.listPayments = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("purpose")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(Object.values(PAYMENT_PURPOSES)),
    query("status")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(Object.values(PAYMENT_STATUSES)),
    query("userId").optional().isMongoId(),
    query("search").optional().trim().isLength({ max: 100 }),
];

exports.paymentId = [
    param("id").isMongoId().withMessage("Invalid payment id"),
];
