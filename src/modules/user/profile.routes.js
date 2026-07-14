const express = require("express");

const profileController = require("./profile.controller");
const profileValidator = require("./profile.validator");
const auth = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validation.middleware");
const { uploadAvatar } = require("../../middleware/upload.middleware");

const router = express.Router();

router.use(auth);

router.get("/", profileController.getMyProfile);

router.get("/referral", profileController.getMyReferralLink);

router.get(
    "/referrals",
    profileValidator.getReferrals,
    validate,
    profileController.getMyReferrals
);

router.post(
    "/complete",
    uploadAvatar,
    profileValidator.complete,
    validate,
    profileController.completeProfile
);

router.put(
    "/",
    uploadAvatar,
    profileValidator.update,
    validate,
    profileController.updateProfile
);

router.delete("/avatar", profileController.deleteAvatar);

module.exports = router;
