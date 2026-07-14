const express = require("express");

const adminController = require("./admin.controller");
const adminWalletController = require("./admin.wallet.controller");
const adminNotificationController = require("./admin.notification.controller");
const adminCreditTokenController = require("./admin.creditToken.controller");
const adminWheelPrizeController = require("./admin.wheelPrize.controller");
const adminScratchPrizeController = require("./admin.scratchPrize.controller");
const adminShufflePrizeController = require("./admin.shufflePrize.controller");
const adminValidator = require("./admin.validator");
const adminWalletValidator = require("./admin.wallet.validator");
const adminCreditTokenValidator = require("./admin.creditToken.validator");
const adminWheelPrizeValidator = require("./admin.wheelPrize.validator");
const adminScratchPrizeValidator = require("./admin.scratchPrize.validator");
const adminShufflePrizeValidator = require("./admin.shufflePrize.validator");
const adminUserRewardController = require("./admin.userReward.controller");
const adminUserRewardValidator = require("./admin.userReward.validator");
const adminTokenPurchaseController = require("./admin.tokenPurchase.controller");
const adminTokenPurchaseValidator = require("./admin.tokenPurchase.validator");
const adminTokenTransferController = require("./admin.tokenTransfer.controller");
const adminTokenTransferValidator = require("./admin.tokenTransfer.validator");
const adminUserReferralController = require("./admin.userReferral.controller");
const adminUserReferralValidator = require("./admin.userReferral.validator");
const auth = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const validate = require("../../middleware/validation.middleware");
const ROLES = require("../../constants/roles");

const router = express.Router();

router.post("/login", adminValidator.login, validate, adminController.login);

router.use(auth);
router.use(authorize(ROLES.ADMIN));

router.get("/me", adminController.getMe);
router.get("/dashboard", adminController.getDashboard);
router.get("/roles", adminController.getRoles);
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserById);
router.patch(
    "/users/:id/status",
    adminValidator.updateUserStatus,
    validate,
    adminController.updateUserStatus
);
router.patch(
    "/users/:id",
    adminValidator.updateUser,
    validate,
    adminController.updateUser
);
router.delete("/users/:id", adminController.deleteUser);

router.get("/wallets", adminWalletController.getWallets);
router.get("/wallets/:id", adminWalletController.getWalletById);
router.post(
    "/wallets",
    adminWalletValidator.createWallet,
    validate,
    adminWalletController.createWallet
);
router.patch(
    "/wallets/:id",
    adminWalletValidator.updateWallet,
    validate,
    adminWalletController.updateWallet
);
router.post(
    "/wallets/:id/adjust-balance",
    adminWalletValidator.adjustBalance,
    validate,
    adminWalletController.adjustBalance
);
router.delete("/wallets/:id", adminWalletController.deleteWallet);

router.get("/notifications", adminNotificationController.getNotifications);
router.get("/notifications/:id", adminNotificationController.getNotificationById);
router.delete("/notifications/:id", adminNotificationController.deleteNotification);

router.get("/tokens", adminCreditTokenController.getTokens);
router.get("/token-types", adminCreditTokenController.getTokenTypes);
router.get("/tokens/:id", adminCreditTokenController.getTokenById);
router.post(
    "/tokens",
    adminCreditTokenValidator.createToken,
    validate,
    adminCreditTokenController.createToken
);
router.patch(
    "/tokens/:id",
    adminCreditTokenValidator.updateToken,
    validate,
    adminCreditTokenController.updateToken
);
router.delete("/tokens/:id", adminCreditTokenController.deleteToken);

router.get(
    "/token-purchases",
    adminTokenPurchaseValidator.getTokenPurchases,
    validate,
    adminTokenPurchaseController.getTokenPurchases
);
router.get(
    "/token-purchases/:id",
    adminTokenPurchaseController.getTokenPurchaseById
);

router.get(
    "/token-transfer-reasons",
    adminTokenTransferController.getTransferReasons
);
router.get(
    "/token-transfers",
    adminTokenTransferValidator.getTransfers,
    validate,
    adminTokenTransferController.getTransfers
);
router.get(
    "/token-transfers/:id",
    adminTokenTransferController.getTransferById
);
router.post(
    "/token-transfers",
    adminTokenTransferValidator.createTransfer,
    validate,
    adminTokenTransferController.createTransfer
);
router.get(
    "/partners/:partnerId/token-balances",
    adminTokenTransferController.getPartnerBalances
);

router.get("/wheel/prizes", adminWheelPrizeController.getPrizes);
router.get("/wheel/prize-types", adminWheelPrizeController.getPrizeTypes);
router.get("/wheel/prizes/:id", adminWheelPrizeController.getPrizeById);
router.post(
    "/wheel/prizes",
    adminWheelPrizeValidator.createPrize,
    validate,
    adminWheelPrizeController.createPrize
);
router.patch(
    "/wheel/prizes/:id",
    adminWheelPrizeValidator.updatePrize,
    validate,
    adminWheelPrizeController.updatePrize
);
router.delete("/wheel/prizes/:id", adminWheelPrizeController.deletePrize);

router.get("/scratch/prizes", adminScratchPrizeController.getPrizes);
router.get("/scratch/prize-types", adminScratchPrizeController.getPrizeTypes);
router.get("/scratch/prizes/:id", adminScratchPrizeController.getPrizeById);
router.post(
    "/scratch/prizes",
    adminScratchPrizeValidator.createPrize,
    validate,
    adminScratchPrizeController.createPrize
);
router.patch(
    "/scratch/prizes/:id",
    adminScratchPrizeValidator.updatePrize,
    validate,
    adminScratchPrizeController.updatePrize
);
router.delete("/scratch/prizes/:id", adminScratchPrizeController.deletePrize);

router.get("/shuffle/prizes", adminShufflePrizeController.getPrizes);
router.get("/shuffle/prize-types", adminShufflePrizeController.getPrizeTypes);
router.get("/shuffle/prizes/:id", adminShufflePrizeController.getPrizeById);
router.post(
    "/shuffle/prizes",
    adminShufflePrizeValidator.createPrize,
    validate,
    adminShufflePrizeController.createPrize
);
router.patch(
    "/shuffle/prizes/:id",
    adminShufflePrizeValidator.updatePrize,
    validate,
    adminShufflePrizeController.updatePrize
);
router.delete("/shuffle/prizes/:id", adminShufflePrizeController.deletePrize);

router.get("/user-rewards", adminUserRewardValidator.getUserRewards, validate, adminUserRewardController.getUserRewards);
router.get("/user-rewards/:id", adminUserRewardController.getUserRewardById);
router.patch(
    "/user-rewards/:id/status",
    adminUserRewardValidator.updateUserRewardStatus,
    validate,
    adminUserRewardController.updateUserRewardStatus
);

router.get(
    "/settings/user-referral",
    adminUserReferralController.getUserReferralSetting
);
router.put(
    "/settings/user-referral",
    adminUserReferralValidator.updateUserReferralSetting,
    validate,
    adminUserReferralController.updateUserReferralSetting
);
router.get(
    "/user-referrals",
    adminUserReferralValidator.getUserReferrals,
    validate,
    adminUserReferralController.getUserReferrals
);

module.exports = router;
