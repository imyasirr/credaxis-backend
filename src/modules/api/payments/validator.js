const { body, param } = require("express-validator");
const { PAYMENT_PURPOSES } = require("../../../integrations/razorpay/constants");

exports.createPayment = [
    body("purpose")
        .trim()
        .toUpperCase()
        .isIn(Object.values(PAYMENT_PURPOSES))
        .withMessage(
            `purpose must be one of: ${Object.values(PAYMENT_PURPOSES).join(", ")}`
        ),
    body("method")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(["ONLINE", "WALLET", "COINS"])
        .withMessage("method must be one of: ONLINE, WALLET, COINS"),
    body("amount")
        .optional()
        .isFloat({ min: 1 })
        .withMessage("Amount must be at least ₹1"),
    body("description").optional().trim().isLength({ max: 200 }),
    body("meta").optional().isObject(),
    body().custom((value) => {
        if (
            value.purpose === PAYMENT_PURPOSES.WALLET_TOPUP &&
            (value.amount === undefined || value.amount === null)
        ) {
            throw new Error("amount is required for WALLET_TOPUP");
        }
        return true;
    }),
];

exports.verifyPayment = [
    body("razorpay_order_id")
        .trim()
        .notEmpty()
        .withMessage("razorpay_order_id is required"),
    body("razorpay_payment_id")
        .trim()
        .notEmpty()
        .withMessage("razorpay_payment_id is required"),
    body("razorpay_signature")
        .trim()
        .notEmpty()
        .withMessage("razorpay_signature is required"),
];

exports.paymentId = [
    param("id").isMongoId().withMessage("Invalid payment id"),
];
