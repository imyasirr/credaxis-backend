const express = require("express");

const userRewardController = require("./userReward.controller");
const userRewardValidator = require("./userReward.validator");
const auth = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validation.middleware");

const router = express.Router();

router.use(auth);

// USER + PARTNER — same logged-in account inbox
router.get(
    "/",
    userRewardValidator.getMyRewards,
    validate,
    userRewardController.getMyRewards
);

router.get("/stats", userRewardController.getMyRewardStats);

router.get(
    "/:id",
    userRewardValidator.rewardId,
    validate,
    userRewardController.getMyRewardById
);

router.patch(
    "/:id/claim",
    userRewardValidator.rewardId,
    validate,
    userRewardController.claimReward
);

module.exports = router;
