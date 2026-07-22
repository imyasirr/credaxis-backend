const express = require("express");

const partnerController = require("./controller");
const partnerValidator = require("./validator");
const auth = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const requireApprovedPartner = require("../../middleware/requireApprovedPartner.middleware");
const requireAction = require("../../middleware/requireAction.middleware");
const validate = require("../../middleware/validation.middleware");
const { uploadPartnerDocs } = require("../../middleware/upload.middleware");
const { uploadKycDocs } = require("../../middleware/upload.middleware");
const ROLES = require("../../constants/roles");
const { ACTIONS } = require("../../constants/userStatusPolicy");
const kycValidator = require("../kyc/validator");

const router = express.Router();

// Public — validate referral code before signup
router.get(
    "/code/:code/validate",
    partnerValidator.validateCode,
    validate,
    partnerController.validatePartnerCode
);

router.use(auth);

router.get(
    "/registration/status",
    requireAction(ACTIONS.PARTNER_READ),
    partnerController.getRegistrationStatus
);

router.post(
    "/apply",
    requireAction(ACTIONS.PARTNER_APPLY),
    uploadPartnerDocs,
    partnerValidator.apply,
    validate,
    partnerController.apply
);

router.get(
    "/me",
    requireAction(ACTIONS.PARTNER_READ),
    partnerController.getMyPartner
);

router.get(
    "/kyc",
    requireAction(ACTIONS.KYC_READ),
    partnerController.getMyKyc
);

router.post(
    "/kyc/submit",
    requireAction(ACTIONS.KYC_SUBMIT),
    uploadKycDocs,
    kycValidator.submit,
    validate,
    partnerController.submitKyc
);

router.put(
    "/me",
    requireAction(ACTIONS.PARTNER_APPLY),
    uploadPartnerDocs,
    partnerValidator.update,
    validate,
    partnerController.updateApplication
);

// Approved partner app surfaces (User.role stays USER)
router.get(
    "/dashboard",
    requireAction(ACTIONS.PARTNER_READ),
    requireApprovedPartner,
    partnerController.getDashboard
);

router.get(
    "/referral-link",
    requireAction(ACTIONS.REFERRAL_READ),
    requireApprovedPartner,
    partnerController.getReferralLink
);

router.get(
    "/referrals/stats",
    requireAction(ACTIONS.REFERRAL_READ),
    requireApprovedPartner,
    partnerController.getReferralStats
);

/** Alias of GET /api/user/referrals (unified USER + PARTNER list) */
router.get(
    "/referrals",
    requireAction(ACTIONS.REFERRAL_READ),
    requireApprovedPartner,
    partnerController.getReferrals
);

router.get(
    "/token-balances",
    requireAction(ACTIONS.PARTNER_READ),
    requireApprovedPartner,
    partnerController.getMyTokenBalances
);

router.get(
    "/token-transfers",
    requireAction(ACTIONS.PARTNER_READ),
    requireApprovedPartner,
    partnerController.getMyTokenTransfers
);

router.get(
    "/token-plans",
    requireAction(ACTIONS.PARTNER_READ),
    requireApprovedPartner,
    partnerValidator.getTokenPlans,
    validate,
    partnerController.getTokenPlans
);

router.post(
    "/token-purchases",
    requireAction(ACTIONS.PARTNER_WRITE),
    requireApprovedPartner,
    partnerValidator.purchaseTokens,
    validate,
    partnerController.purchaseTokens
);

router.get(
    "/token-purchases",
    requireAction(ACTIONS.PARTNER_READ),
    requireApprovedPartner,
    partnerValidator.getTokenPurchases,
    validate,
    partnerController.getMyTokenPurchases
);

router.get(
    "/token-purchases/:id",
    requireAction(ACTIONS.PARTNER_READ),
    requireApprovedPartner,
    partnerController.getMyTokenPurchaseById
);

router.post(
    "/token-purchases/:id/verify-payment",
    requireAction(ACTIONS.PARTNER_WRITE),
    requireApprovedPartner,
    partnerValidator.verifyOnlinePayment,
    validate,
    partnerController.verifyOnlinePayment
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
