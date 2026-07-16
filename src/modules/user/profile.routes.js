const express = require("express");

const profileController = require("./profile.controller");
const profileValidator = require("./profile.validator");
const auth = require("../../middleware/auth.middleware");
const requireAction = require("../../middleware/requireAction.middleware");
const validate = require("../../middleware/validation.middleware");
const { uploadAvatar } = require("../../middleware/upload.middleware");
const { ACTIONS } = require("../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/",
    requireAction(ACTIONS.PROFILE_READ),
    profileController.getMyProfile
);

router.get(
    "/referral",
    requireAction(ACTIONS.REFERRAL_READ),
    profileController.getMyReferralLink
);

router.get(
    "/referrals",
    requireAction(ACTIONS.REFERRAL_READ),
    profileValidator.getReferrals,
    validate,
    profileController.getMyReferrals
);

router.post(
    "/complete",
    requireAction(ACTIONS.PROFILE_WRITE),
    uploadAvatar,
    profileValidator.complete,
    validate,
    profileController.completeProfile
);

router.put(
    "/",
    requireAction(ACTIONS.PROFILE_WRITE),
    uploadAvatar,
    profileValidator.update,
    validate,
    profileController.updateProfile
);

router.delete(
    "/avatar",
    requireAction(ACTIONS.PROFILE_WRITE),
    profileController.deleteAvatar
);

module.exports = router;
