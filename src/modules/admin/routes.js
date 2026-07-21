const express = require("express");

const adminController = require("./controller");
const adminWalletController = require("./wallet.controller");
const adminCoinsController = require("./coins.controller");
const adminCoinTransferController = require("./coinTransfer.controller");
const adminNotificationController = require("./notification.controller");
const adminCreditTokenController = require("./creditToken.controller");
const adminWheelPrizeController = require("./wheelPrize.controller");
const adminScratchPrizeController = require("./scratchPrize.controller");
const adminShufflePrizeController = require("./shufflePrize.controller");
const adminValidator = require("./validator");
const adminWalletValidator = require("./wallet.validator");
const adminCoinsValidator = require("./coins.validator");
const adminCoinTransferValidator = require("./coinTransfer.validator");
const adminCreditTokenValidator = require("./creditToken.validator");
const adminWheelPrizeValidator = require("./wheelPrize.validator");
const adminScratchPrizeValidator = require("./scratchPrize.validator");
const adminShufflePrizeValidator = require("./shufflePrize.validator");
const adminUserRewardController = require("./userReward.controller");
const adminUserRewardValidator = require("./userReward.validator");
const adminTokenPurchaseController = require("./tokenPurchase.controller");
const adminTokenPurchaseValidator = require("./tokenPurchase.validator");
const adminTokenTransferController = require("./tokenTransfer.controller");
const adminTokenTransferValidator = require("./tokenTransfer.validator");
const adminUserReferralController = require("./userReferral.controller");
const adminUserReferralValidator = require("./userReferral.validator");
const adminRewardRuleController = require("./rewardRule.controller");
const adminRewardRuleValidator = require("./rewardRule.validator");
const auth = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const validate = require("../../middleware/validation.middleware");
const { uploadAvatar } = require("../../middleware/upload.middleware");
const ROLES = require("../../constants/roles");

const router = express.Router();

router.post("/login", adminValidator.login, validate, adminController.login);

router.use(auth);
router.use(authorize(ROLES.ADMIN));

router.get("/me", adminController.getMe);
router.patch(
    "/me",
    uploadAvatar,
    adminValidator.updateMe,
    validate,
    adminController.updateMe
);
router.delete("/me/avatar", adminController.deleteMyAvatar);
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

router.get("/coins", adminCoinsController.getCoinWallets);
router.get("/coins/:id", adminCoinsController.getCoinWalletById);
router.post(
    "/coins",
    adminCoinsValidator.createCoinWallet,
    validate,
    adminCoinsController.createCoinWallet
);
router.patch(
    "/coins/:id",
    adminCoinsValidator.updateCoinWallet,
    validate,
    adminCoinsController.updateCoinWallet
);
router.post(
    "/coins/:id/adjust-balance",
    adminCoinsValidator.adjustBalance,
    validate,
    adminCoinsController.adjustBalance
);
router.delete("/coins/:id", adminCoinsController.deleteCoinWallet);

router.get(
    "/coin-transfer-reasons",
    adminCoinTransferController.getTransferReasons
);
router.get(
    "/coin-transfers",
    adminCoinTransferValidator.getTransfers,
    validate,
    adminCoinTransferController.getTransfers
);
router.get(
    "/coin-transfers/:id",
    adminCoinTransferController.getTransferById
);
router.post(
    "/coin-transfers",
    adminCoinTransferValidator.createTransfer,
    validate,
    adminCoinTransferController.createTransfer
);

router.get("/notifications", adminNotificationController.getNotifications);
router.post(
    "/notifications",
    adminNotificationController.sendToUser
);
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

router.get("/reward-rules/meta", adminRewardRuleController.getMeta);
router.get(
    "/reward-rules",
    adminRewardRuleValidator.listRules,
    validate,
    adminRewardRuleController.listRules
);
router.post(
    "/reward-rules/grant",
    adminRewardRuleValidator.grantManual,
    validate,
    adminRewardRuleController.grantManual
);
router.post(
    "/reward-rules",
    adminRewardRuleValidator.createRule,
    validate,
    adminRewardRuleController.createRule
);
router.get(
    "/reward-rules/:id",
    adminRewardRuleValidator.ruleId,
    validate,
    adminRewardRuleController.getRuleById
);
router.patch(
    "/reward-rules/:id",
    adminRewardRuleValidator.updateRule,
    validate,
    adminRewardRuleController.updateRule
);
router.delete(
    "/reward-rules/:id",
    adminRewardRuleValidator.ruleId,
    validate,
    adminRewardRuleController.deleteRule
);

module.exports = router;
