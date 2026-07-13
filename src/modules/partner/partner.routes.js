const express = require("express");

const partnerController = require("./partner.controller");
const partnerValidator = require("./partner.validator");
const auth = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const validate = require("../../middleware/validation.middleware");
const { uploadPartnerDocs } = require("../../middleware/upload.middleware");
const ROLES = require("../../constants/roles");

const router = express.Router();

// Public — validate referral code before signup
router.get(
    "/code/:code/validate",
    partnerValidator.validateCode,
    validate,
    partnerController.validatePartnerCode
);

router.use(auth);

// Registration flow
router.get("/registration/status", partnerController.getRegistrationStatus);

router.post(
    "/apply",
    uploadPartnerDocs,
    partnerValidator.apply,
    validate,
    partnerController.apply
);

router.get("/me", partnerController.getMyPartner);

router.put(
    "/me",
    uploadPartnerDocs,
    partnerValidator.update,
    validate,
    partnerController.updateApplication
);

// Approved partner only
router.get(
    "/dashboard",
    authorize(ROLES.PARTNER),
    partnerController.getDashboard
);

router.get(
    "/referral-link",
    authorize(ROLES.PARTNER),
    partnerController.getReferralLink
);

router.get(
    "/referrals/stats",
    authorize(ROLES.PARTNER),
    partnerController.getReferralStats
);

router.get(
    "/referrals",
    authorize(ROLES.PARTNER),
    partnerController.getReferrals
);

// Admin
router.get(
    "/admin/applications",
    authorize(ROLES.ADMIN),
    partnerController.getApplications
);

router.get(
    "/admin/list",
    authorize(ROLES.ADMIN),
    partnerController.getAllPartners
);

router.patch(
    "/admin/:id/approve",
    authorize(ROLES.ADMIN),
    partnerValidator.approve,
    validate,
    partnerController.approve
);

router.patch(
    "/admin/:id/reject",
    authorize(ROLES.ADMIN),
    partnerValidator.reject,
    validate,
    partnerController.reject
);

module.exports = router;
