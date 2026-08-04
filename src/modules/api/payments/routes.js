const express = require("express");

const controller = require("./controller");
const validator = require("./validator");
const auth = require("../../../middleware/auth.middleware");
const requireAction = require("../../../middleware/requireAction.middleware");
const validate = require("../../../middleware/validation.middleware");
const { ACTIONS } = require("../../../constants/userStatusPolicy");
const { PAYMENT_PURPOSES } = require("../../../integrations/razorpay/constants");
const ApiError = require("../../../utils/ApiError");

const router = express.Router();

router.use(auth);

/** Soft gate: purpose decides which action is needed */
const requirePurposeAction = (req, _res, next) => {
    const purpose = String(req.body?.purpose || "").toUpperCase();

    if (purpose === PAYMENT_PURPOSES.WALLET_TOPUP) {
        return requireAction(ACTIONS.WALLET_WRITE)(req, _res, next);
    }
    if (purpose === PAYMENT_PURPOSES.CREDIT_CHECK) {
        return requireAction(ACTIONS.CREDIT_FETCH)(req, _res, next);
    }

    return next(
        new ApiError(
            400,
            `purpose must be one of: ${Object.values(PAYMENT_PURPOSES).join(", ")}`
        )
    );
};

router.get(
    "/credit-check-fee",
    requireAction(ACTIONS.CREDIT_READ),
    controller.getCreditCheckFee
);

router.post(
    "/create",
    requirePurposeAction,
    validator.createPayment,
    validate,
    controller.createPayment
);

router.post(
    "/verify",
    requireAction(ACTIONS.WALLET_WRITE, ACTIONS.CREDIT_FETCH),
    validator.verifyPayment,
    validate,
    controller.verifyPayment
);

router.get(
    "/:id",
    requireAction(ACTIONS.WALLET_READ, ACTIONS.CREDIT_READ),
    validator.paymentId,
    validate,
    controller.getPaymentById
);

module.exports = router;
