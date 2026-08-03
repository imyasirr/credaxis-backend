const express = require("express");

const controller = require("./controller");
const userGamePlayService = require("./userGamePlay.service");
const auth = require("../../../middleware/auth.middleware");
const requireAction = require("../../../middleware/requireAction.middleware");
const { ACTIONS } = require("../../../constants/userStatusPolicy");
const { param } = require("express-validator");
const validate = require("../../../middleware/validation.middleware");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

const router = express.Router();

const gameTypeParam = [
    param("gameType")
        .isString()
        .customSanitizer((v) => String(v || "").toUpperCase())
        .isIn(["WHEEL", "SCRATCH", "SHUFFLE"]),
];

router.use(auth);

/** Available games for this user (with play counts + webview paths) */
router.get(
    "/my-games",
    requireAction(ACTIONS.REWARDS_READ),
    asyncHandler(async (req, res) => {
        const data = await userGamePlayService.getMyGames(req.user.id);
        return response.success(res, "Available games fetched", data);
    })
);

router.get(
    "/:gameType/prizes",
    requireAction(ACTIONS.REWARDS_READ),
    gameTypeParam,
    validate,
    controller.getPrizes
);

router.post(
    "/:gameType/play",
    requireAction(ACTIONS.REWARDS_CLAIM),
    gameTypeParam,
    validate,
    controller.play
);

module.exports = router;
