const express = require("express");

const router = express.Router();

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/profile", require("../modules/user/profile.routes"));
router.use("/wallet", require("../modules/wallet/wallet.routes"));
router.use("/kyc", require("../modules/kyc/kyc.routes"));
router.use("/notifications", require("../modules/notification/notification.routes"));
router.use("/rewards", require("../modules/rewards/userReward.routes"));
router.use("/credit-reports", require("../modules/creditReport/creditReport.routes"));
router.use("/partner", require("../modules/partner/partner.routes"));
router.use("/admin", require("../modules/admin/admin.routes"));

module.exports = router;
