const express = require("express");
const controller = require("./controller");

const router = express.Router();

/** Public RocketPay webhook (optional secret via ROCKETPAY_WEBHOOK_SECRET) */
router.post("/rocketpay", controller.webhook);

module.exports = router;
