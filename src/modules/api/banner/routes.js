const express = require("express");

const bannerController = require("./controller");
const auth = require("../../../middleware/auth.middleware");
const requireAction = require("../../../middleware/requireAction.middleware");
const { ACTIONS } = require("../../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/",
    requireAction(ACTIONS.PROFILE_READ),
    bannerController.getActiveBanners
);

module.exports = router;
