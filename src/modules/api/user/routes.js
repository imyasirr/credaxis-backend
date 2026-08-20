const express = require("express");

const controller = require("./controller");
const validator = require("./validator");
const auth = require("../../../middleware/auth.middleware");
const requireAction = require("../../../middleware/requireAction.middleware");
const validate = require("../../../middleware/validation.middleware");
const { uploadAvatar } = require("../../../middleware/upload.middleware");
const { ACTIONS } = require("../../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/",
    requireAction(ACTIONS.PROFILE_READ),
    controller.getMyProfile
);

router.get(
    "/dashboard",
    requireAction(ACTIONS.PROFILE_READ),
    controller.getDashboard
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

/** Account deletion request (soft-delete after admin approval) */
router.post(
    "/deletion-request",
    requireAction(ACTIONS.PROFILE_WRITE),
    validator.requestDeletion,
    validate,
    controller.requestDeletion
);
router.get(
    "/deletion-request",
    requireAction(ACTIONS.PROFILE_READ),
    controller.getMyDeletionRequest
);
router.delete(
    "/deletion-request",
    requireAction(ACTIONS.PROFILE_WRITE),
    controller.cancelDeletionRequest
);

/** Mandate intro story — seen / activated flag */
router.get(
    "/mandate-story",
    requireAction(ACTIONS.PROFILE_READ),
    controller.getMandateStory
);
router.patch(
    "/mandate-story",
    requireAction(ACTIONS.PROFILE_WRITE),
    validator.setMandateStory,
    validate,
    controller.setMandateStory
);

/** DLC intro story — seen / activated flag */
router.get(
    "/dlc-story",
    requireAction(ACTIONS.PROFILE_READ),
    controller.getDlcStory
);
router.patch(
    "/dlc-story",
    requireAction(ACTIONS.PROFILE_WRITE),
    validator.setDlcStory,
    validate,
    controller.setDlcStory
);

module.exports = router;
