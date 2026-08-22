const express = require("express");

const controller = require("./controller");
const requireAppCredentialsAccess = require("../../../middleware/requireAppCredentialsAccess.middleware");

const router = express.Router();

/** Dev-only — no JWT. Requires APP_CREDENTIALS_ACCESS match. */
router.get(
    "/rocketpay",
    requireAppCredentialsAccess,
    controller.getRocketPayCredentials
);

module.exports = router;
