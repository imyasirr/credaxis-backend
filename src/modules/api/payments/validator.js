const { body, param } = require("express-validator");
const { PAYMENT_PURPOSES } = require("../../../integrations/razorpay/constants");
const { MANDATE_FREQUENCIES } = require("../mandate/constants");

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
    body("frequency")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(MANDATE_FREQUENCIES)
        .withMessage(
            `frequency must be one of: ${MANDATE_FREQUENCIES.join(", ")}`
        ),
    body("installment_count")
        .optional()
        .isInt({ min: 0 })
        .withMessage("installment_count must be >= 0"),
    body("installmentCount")
        .optional()
        .isInt({ min: 0 })
        .withMessage("installmentCount must be >= 0"),
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
