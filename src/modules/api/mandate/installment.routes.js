const express = require("express");

const controller = require("./controller");
const validator = require("./validator");
const auth = require("../../../middleware/auth.middleware");
const requireAction = require("../../../middleware/requireAction.middleware");
const validate = require("../../../middleware/validation.middleware");
const { ACTIONS } = require("../../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/",
    requireAction(ACTIONS.MANDATE_READ),
    validator.listInstallments,
    validate,
    controller.listInstallmentsByMandate
);

router.get(
    "/:id",
    requireAction(ACTIONS.MANDATE_READ),
    validator.installmentId,
    validate,
    controller.getInstallment
);

router.post(
    "/:id/refresh",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.installmentId,
    validate,
    controller.refreshInstallment
);

router.post(
    "/:id/skip",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.installmentId,
    validate,
    controller.skipInstallment
);

router.post(
    "/:id/retry",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.installmentId,
    validator.retryInstallment,
    validate,
    controller.retryInstallment
);

module.exports = router;
