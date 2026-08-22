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
    "/collections/summary",
    requireAction(ACTIONS.MANDATE_READ),
    validator.collectionsSummary,
    validate,
    controller.getCollectionsSummary
);

router.get(
    "/collections",
    requireAction(ACTIONS.MANDATE_READ),
    validator.listCollections,
    validate,
    controller.listMandateCollections
);

router.post(
    "/",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.createMandate,
    validate,
    controller.createMandate
);

router.get(
    "/",
    requireAction(ACTIONS.MANDATE_READ),
    validator.listMandates,
    validate,
    controller.listMandates
);

router.get(
    "/:id/collections",
    requireAction(ACTIONS.MANDATE_READ),
    validator.mandateId,
    validate,
    controller.getMandateCollections
);

router.get(
    "/:id",
    requireAction(ACTIONS.MANDATE_READ),
    validator.mandateId,
    validate,
    controller.getMandate
);

router.post(
    "/:id/refresh",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.mandateId,
    validate,
    controller.refreshMandate
);

router.delete(
    "/:id",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.mandateId,
    validate,
    controller.deleteMandate
);

router.post(
    "/:id/cancel",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.mandateId,
    validate,
    controller.cancelMandate
);

router.post(
    "/:id/installment",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.mandateId,
    validator.createInstallment,
    validate,
    controller.createInstallment
);

router.get(
    "/:id/installments",
    requireAction(ACTIONS.MANDATE_READ),
    validator.mandateId,
    validate,
    controller.listInstallmentsByMandate
);

module.exports = router;
