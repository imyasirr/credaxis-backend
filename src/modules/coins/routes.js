const express = require("express");

const coinController = require("./controller");
const coinValidator = require("./validator");
const auth = require("../../middleware/auth.middleware");
const requireAction = require("../../middleware/requireAction.middleware");
const validate = require("../../middleware/validation.middleware");
const { ACTIONS } = require("../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/",
    requireAction(ACTIONS.REWARDS_READ),
    coinController.getMyCoins
);

router.get(
    "/transactions",
    requireAction(ACTIONS.REWARDS_READ),
    coinValidator.getTransactions,
    validate,
    coinController.getTransactions
);

module.exports = router;
