const express = require("express");

const bannerController = require("./controller");
const bannerValidator = require("./validator");
const auth = require("../../../middleware/auth.middleware");
const optionalAuth = require("../../../middleware/optionalAuth.middleware");
const requireAction = require("../../../middleware/requireAction.middleware");
const validate = require("../../../middleware/validation.middleware");
const { ACTIONS } = require("../../../constants/userStatusPolicy");

const router = express.Router();

router.get(
    "/",
    auth,
    requireAction(ACTIONS.PROFILE_READ),
    bannerController.getActiveBanners
);

router.post(
    "/:id/click",
    optionalAuth,
    bannerValidator.bannerId,
    validate,
    bannerController.recordClick
);

module.exports = router;
