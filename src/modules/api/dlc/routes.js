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
    "/fee",
    requireAction(ACTIONS.WALLET_READ),
    controller.getFee
);

router.get(
    "/catalogue",
    requireAction(ACTIONS.MANDATE_READ),
    validator.catalogue,
    validate,
    controller.getCatalogue
);

router.post(
    "/keys",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.createKey,
    validate,
    controller.createKey
);

router.get(
    "/keys",
    requireAction(ACTIONS.MANDATE_READ),
    validator.listKeys,
    validate,
    controller.listKeys
);

router.get(
    "/keys/:id",
    requireAction(ACTIONS.MANDATE_READ),
    validator.keyId,
    validate,
    controller.getKey
);

router.post(
    "/keys/:id/refresh",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.keyId,
    validate,
    controller.refreshKey
);

router.post(
    "/keys/:id/unregister",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.keyId,
    validate,
    controller.unregisterKey
);

router.post(
    "/keys/:id/lock",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.keyId,
    validator.lockBody,
    validate,
    controller.lockKey
);

router.post(
    "/keys/:id/unlock",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.keyId,
    validator.lockBody,
    validate,
    controller.unlockKey
);

router.post(
    "/keys/:id/reminders/text",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.keyId,
    validator.reminderBody,
    validate,
    controller.sendTextReminder
);

router.post(
    "/keys/:id/reminders/full-screen",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.keyId,
    validator.reminderBody,
    validate,
    controller.sendFullScreenReminder
);

router.post(
    "/keys/:id/unlock-code",
    requireAction(ACTIONS.MANDATE_WRITE),
    validator.keyId,
    validator.unlockCodeBody,
    validate,
    controller.fetchUnlockCode
);

router.get(
    "/keys/:id/actions",
    requireAction(ACTIONS.MANDATE_READ),
    validator.keyId,
    validate,
    controller.listActions
);

router.get(
    "/keys/:id/controls",
    requireAction(ACTIONS.MANDATE_READ),
    validator.keyId,
    validate,
    controller.getControls
);

module.exports = router;
