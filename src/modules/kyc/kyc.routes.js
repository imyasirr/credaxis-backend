const express = require("express");

const kycController = require("./kyc.controller");
const kycValidator = require("./kyc.validator");
const auth = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const validate = require("../../middleware/validation.middleware");
const { uploadKycDocs } = require("../../middleware/upload.middleware");
const ROLES = require("../../constants/roles");

const router = express.Router();

router.use(auth);

router.get("/", kycController.getMyKyc);

router.post(
    "/submit",
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
