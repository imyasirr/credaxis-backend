const express = require("express");

const controller = require("./controller");
const validator = require("./validator");
const auth = require("../../../middleware/auth.middleware");
const validate = require("../../../middleware/validation.middleware");
const requireAction = require("../../../middleware/requireAction.middleware");
const { ACTIONS } = require("../../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/config",
    requireAction(ACTIONS.REWARDS_READ),
    controller.getConfig
);

router.post(
    "/complete",
    requireAction(ACTIONS.REWARDS_CLAIM),
    validator.completePlay,
    validate,
    controller.completePlay
);

module.exports = router;
