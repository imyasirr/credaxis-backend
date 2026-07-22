const express = require("express");

const controller = require("./controller");
const validator = require("./validator");
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
    controller.getMyProfile
);

router.post(
    "/complete",
    requireAction(ACTIONS.PROFILE_WRITE),
    uploadAvatar,
    validator.complete,
    validate,
    controller.completeProfile
);

router.put(
    "/",
    requireAction(ACTIONS.PROFILE_WRITE),
    uploadAvatar,
    validator.update,
    validate,
    controller.updateProfile
);

router.delete(
    "/avatar",
    requireAction(ACTIONS.PROFILE_WRITE),
    controller.deleteAvatar
);

/** Referral summary / share code — USER + PARTNER (role auto-detected) */
router.get(
    "/referral-link",
    requireAction(ACTIONS.REFERRAL_READ),
    controller.getMyReferralLink
);

/** Unified referrals list — USER sees USR; PARTNER sees USR + PRT */
router.get(
    "/referrals",
    requireAction(ACTIONS.REFERRAL_READ),
    validator.getReferrals,
    validate,
    controller.getMyReferrals
);

module.exports = router;
