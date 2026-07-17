const express = require("express");

const creditReportController = require("./creditReport.controller");
const creditReportValidator = require("./creditReport.validator");
const auth = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const requireAction = require("../../middleware/requireAction.middleware");
const validate = require("../../middleware/validation.middleware");
const ROLES = require("../../constants/roles");
const { ACTIONS } = require("../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

// Admin first (before /:id)
router.get(
    "/admin/list",
    authorize(ROLES.ADMIN),
    creditReportValidator.adminList,
    validate,
    creditReportController.adminList
);

router.post(
    "/admin/fetch",
    authorize(ROLES.ADMIN),
    creditReportValidator.adminFetch,
    validate,
    creditReportController.adminFetch
);

router.get(
    "/admin/user/:userId",
    authorize(ROLES.ADMIN),
    creditReportValidator.adminUserChecklist,
    validate,
    creditReportController.adminUserChecklist
);

router.get(
    "/admin/:id",
    authorize(ROLES.ADMIN),
    creditReportValidator.reportId,
    validate,
    creditReportController.adminGetById
);

// User — fetch Equifax summary (+ PDF)
router.post(
    "/fetch",
    requireAction(ACTIONS.CREDIT_FETCH),
    creditReportValidator.fetch,
    validate,
    creditReportController.fetchMyCreditReport
);

router.get(
    "/",
    requireAction(ACTIONS.CREDIT_READ),
    creditReportValidator.listMine,
    validate,
    creditReportController.getMyReports
);

router.get(
    "/latest",
    requireAction(ACTIONS.CREDIT_READ),
    creditReportController.getMyLatestReport
);

router.get(
    "/:id",
    requireAction(ACTIONS.CREDIT_READ),
    creditReportValidator.reportId,
    validate,
    creditReportController.getMyReportById
);

module.exports = router;
