const express = require("express");

const router = express.Router();

// Mobile / app API routes (URLs unchanged under /api/*)
router.use("/auth", require("./auth/routes"));
router.use("/user", require("./user/routes"));
router.use("/wallet", require("./wallet/routes"));
router.use("/payments", require("./payments/routes"));
router.use("/coins", require("./coins/routes"));
router.use("/kyc", require("./kyc/routes"));
router.use("/notifications", require("./notification/routes"));
router.use("/rewards", require("./rewards/routes"));
router.use("/credit-reports", require("./creditReport/routes"));
router.use("/partner", require("./partner/routes"));
router.use("/bubble-game", require("./bubbleGame/routes"));
router.use("/games", require("./games/routes"));
router.use("/mandates", require("./mandate/routes"));
router.use("/installments", require("./mandate/installment.routes"));
router.use("/webhooks", require("./mandate/webhook.routes"));
router.use("/dlc", require("./dlc/routes"));
router.use("/banners", require("./banner/routes"));

module.exports = router;
