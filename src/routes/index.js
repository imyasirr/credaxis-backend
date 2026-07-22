const express = require("express");

const router = express.Router();

router.use("/auth", require("../modules/auth/routes"));
router.use("/user", require("../modules/user/routes"));
router.use("/wallet", require("../modules/wallet/routes"));
router.use("/coins", require("../modules/coins/routes"));
router.use("/kyc", require("../modules/kyc/routes"));
router.use("/notifications", require("../modules/notification/routes"));
router.use("/rewards", require("../modules/rewards/routes"));
router.use("/credit-reports", require("../modules/creditReport/routes"));
router.use("/partner", require("../modules/partner/routes"));
router.use("/admin", require("../modules/admin/routes"));

module.exports = router;
