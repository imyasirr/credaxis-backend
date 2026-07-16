const express = require("express");

const userRewardController = require("./userReward.controller");
const userRewardValidator = require("./userReward.validator");
const auth = require("../../middleware/auth.middleware");
const requireAction = require("../../middleware/requireAction.middleware");
const validate = require("../../middleware/validation.middleware");
const { ACTIONS } = require("../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/",
    requireAction(ACTIONS.REWARDS_READ),
    userRewardValidator.getMyRewards,
    validate,
    userRewardController.getMyRewards
);

router.get(
    "/stats",
    requireAction(ACTIONS.REWARDS_READ),
    userRewardController.getMyRewardStats
);

router.get(
    "/:id",
    requireAction(ACTIONS.REWARDS_READ),
    userRewardValidator.rewardId,
    validate,
    userRewardController.getMyRewardById
);

router.patch(
    "/:id/claim",
    requireAction(ACTIONS.REWARDS_CLAIM),
    userRewardValidator.rewardId,
    validate,
    userRewardController.claimReward
);

module.exports = router;
