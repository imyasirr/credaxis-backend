const express = require("express");

const kycController = require("./controller");
const kycValidator = require("./validator");
const auth = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const requireAction = require("../../middleware/requireAction.middleware");
const validate = require("../../middleware/validation.middleware");
const { uploadKycDocs } = require("../../middleware/upload.middleware");
const ROLES = require("../../constants/roles");
const { ACTIONS } = require("../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get("/", requireAction(ACTIONS.KYC_READ), kycController.getMyKyc);

router.post(
    "/submit",
    requireAction(ACTIONS.KYC_SUBMIT),
    uploadKycDocs,
    kycValidator.submit,
    validate,
    kycController.submitKyc
);

router.get(
    "/admin/pending",
    authorize(ROLES.ADMIN),
    kycController.getPendingList
);

router.patch(
    "/admin/:id/approve",
    authorize(ROLES.ADMIN),
    kycController.approveKyc
);

router.patch(
    "/admin/:id/reject",
    authorize(ROLES.ADMIN),
    kycValidator.reject,
    validate,
    kycController.rejectKyc
);

module.exports = router;
