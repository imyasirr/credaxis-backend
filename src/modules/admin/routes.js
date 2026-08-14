const express = require("express");

const adminController = require("./auth/controller");
const adminValidator = require("./auth/validator");

const adminWalletController = require("./wallet/wallet.controller");
const adminWalletValidator = require("./wallet/wallet.validator");
const adminWithdrawalController = require("./wallet/withdrawal.controller");
const adminWithdrawalValidator = require("./wallet/withdrawal.validator");

const adminCoinsController = require("./coins/coins.controller");
const adminCoinsValidator = require("./coins/coins.validator");
const adminCoinTransferController = require("./coins/coinTransfer.controller");
const adminCoinTransferValidator = require("./coins/coinTransfer.validator");

const adminNotificationController = require("./notifications/notification.controller");

const adminCreditTokenController = require("./tokens/creditToken.controller");
const adminCreditTokenValidator = require("./tokens/creditToken.validator");
const adminTokenPurchaseController = require("./tokens/tokenPurchase.controller");
const adminTokenPurchaseValidator = require("./tokens/tokenPurchase.validator");
const adminTokenTransferController = require("./tokens/tokenTransfer.controller");
const adminTokenTransferValidator = require("./tokens/tokenTransfer.validator");

const adminWheelPrizeController = require("./games/wheelPrize.controller");
const adminWheelPrizeValidator = require("./games/wheelPrize.validator");
const adminScratchPrizeController = require("./games/scratchPrize.controller");
const adminScratchPrizeValidator = require("./games/scratchPrize.validator");
const adminShufflePrizeController = require("./games/shufflePrize.controller");
const adminShufflePrizeValidator = require("./games/shufflePrize.validator");
const adminBubbleGameController = require("./games/bubbleGame.controller");
const adminGamePlayController = require("./games/gamePlay.controller");

const adminUserRewardController = require("./rewards/userReward.controller");
const adminUserRewardValidator = require("./rewards/userReward.validator");
const adminUserReferralController = require("./rewards/userReferral.controller");
const adminUserReferralValidator = require("./rewards/userReferral.validator");
const adminRewardRuleController = require("./rewards/rewardRule.controller");
const adminRewardRuleValidator = require("./rewards/rewardRule.validator");

const adminMandateController = require("./mandates/mandate.controller");
const adminMandateValidator = require("./mandates/mandate.validator");

const adminSettingsController = require("./settings/settings.controller");
const adminSettingsValidator = require("./settings/settings.validator");

const adminPaymentController = require("./payments/payment.controller");
const adminPaymentValidator = require("./payments/payment.validator");

const adminWebsiteController = require("./website/controller");
const adminWebsiteValidator = require("./website/validator");

const auth = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const validate = require("../../middleware/validation.middleware");
const { uploadAvatar, uploadWebsiteMedia } = require("../../middleware/upload.middleware");
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

router.get(
    "/deletion-requests",
    adminValidator.listDeletionRequests,
    validate,
    adminController.listDeletionRequests
);
router.get(
    "/deletion-requests/:id",
    adminValidator.deletionRequestId,
    validate,
    adminController.getDeletionRequestById
);
router.post(
    "/deletion-requests/:id/approve",
    adminValidator.approveDeletionRequest,
    validate,
    adminController.approveDeletionRequest
);
router.post(
    "/deletion-requests/:id/reject",
    adminValidator.rejectDeletionRequest,
    validate,
    adminController.rejectDeletionRequest
);

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

router.get(
    "/withdrawals",
    adminWithdrawalValidator.list,
    validate,
    adminWithdrawalController.list
);
router.get(
    "/withdrawals/:id",
    adminWithdrawalValidator.withdrawalId,
    validate,
    adminWithdrawalController.getById
);
router.post(
    "/withdrawals/:id/initiate",
    adminWithdrawalValidator.withdrawalId,
    adminWithdrawalValidator.initiate,
    validate,
    adminWithdrawalController.initiate
);
router.post(
    "/withdrawals/:id/success",
    adminWithdrawalValidator.withdrawalId,
    adminWithdrawalValidator.markSuccess,
    validate,
    adminWithdrawalController.markSuccess
);
router.post(
    "/withdrawals/:id/reject",
    adminWithdrawalValidator.withdrawalId,
    adminWithdrawalValidator.rejectOrFail,
    validate,
    adminWithdrawalController.reject
);
router.post(
    "/withdrawals/:id/fail",
    adminWithdrawalValidator.withdrawalId,
    adminWithdrawalValidator.rejectOrFail,
    validate,
    adminWithdrawalController.markFailed
);
router.patch(
    "/withdrawals/:id/expected-at",
    adminWithdrawalValidator.withdrawalId,
    adminWithdrawalValidator.updateExpected,
    validate,
    adminWithdrawalController.updateExpected
);

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
router.get(
    "/notifications/broadcast/audiences",
    adminNotificationController.getAudiences
);
router.get(
    "/notifications/broadcast/preview",
    adminNotificationController.previewBroadcast
);
router.post(
    "/notifications/broadcast",
    adminNotificationController.broadcast
);
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

router.get("/bubble-game/settings", adminBubbleGameController.getSettings);
router.put(
    "/bubble-game/settings",
    adminBubbleGameController.updateSettingsValidators,
    validate,
    adminBubbleGameController.updateSettings
);

router.post(
    "/game-plays/grant",
    adminGamePlayController.grantPlaysValidators,
    validate,
    adminGamePlayController.grantPlays
);

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
    "/settings/credit-check-fee",
    adminSettingsController.getCreditCheckFee
);
router.put(
    "/settings/credit-check-fee",
    adminSettingsValidator.updateCreditCheckFee,
    validate,
    adminSettingsController.updateCreditCheckFee
);
router.get(
    "/settings/mandate-create-fee",
    adminSettingsController.getMandateCreateFee
);
router.put(
    "/settings/mandate-create-fee",
    adminSettingsValidator.updateMandateCreateFee,
    validate,
    adminSettingsController.updateMandateCreateFee
);
router.get(
    "/settings/mandate-installment-fee",
    adminSettingsController.getMandateInstallmentFee
);
router.put(
    "/settings/mandate-installment-fee",
    adminSettingsValidator.updateMandateInstallmentFee,
    validate,
    adminSettingsController.updateMandateInstallmentFee
);
router.get(
    "/settings/first-topup-bonus",
    adminSettingsController.getFirstTopupBonus
);
router.put(
    "/settings/first-topup-bonus",
    adminSettingsValidator.updateFirstTopupBonus,
    validate,
    adminSettingsController.updateFirstTopupBonus
);

router.get(
    "/payments",
    adminPaymentValidator.listPayments,
    validate,
    adminPaymentController.listPayments
);
router.get(
    "/payments/:id",
    adminPaymentValidator.paymentId,
    validate,
    adminPaymentController.getPaymentById
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

// ── Mandates (RocketPay) ──────────────────────────────────────
router.get("/mandates/dashboard", adminMandateController.getDashboard);
router.get(
    "/mandates/users",
    adminMandateValidator.listUsersSummary,
    validate,
    adminMandateController.getUsersSummary
);
router.get(
    "/mandates",
    adminMandateValidator.listMandates,
    validate,
    adminMandateController.getMandates
);
router.post(
    "/mandates/recon",
    adminMandateValidator.recon,
    validate,
    adminMandateController.reconMandates
);
router.get(
    "/mandates/:id",
    adminMandateValidator.mandateId,
    validate,
    adminMandateController.getMandateById
);
router.post(
    "/mandates/:id/refresh",
    adminMandateValidator.mandateId,
    validate,
    adminMandateController.refreshMandate
);
router.post(
    "/mandates/:id/cancel",
    adminMandateValidator.mandateId,
    validate,
    adminMandateController.cancelMandate
);

router.get(
    "/mandate-installments",
    adminMandateValidator.listInstallments,
    validate,
    adminMandateController.getInstallments
);
router.post(
    "/mandate-installments/recon",
    adminMandateValidator.recon,
    validate,
    adminMandateController.reconInstallments
);
router.get(
    "/mandate-installments/:id",
    adminMandateValidator.installmentId,
    validate,
    adminMandateController.getInstallmentById
);
router.post(
    "/mandate-installments/:id/refresh",
    adminMandateValidator.installmentId,
    validate,
    adminMandateController.refreshInstallment
);
router.post(
    "/mandate-installments/:id/skip",
    adminMandateValidator.installmentId,
    validate,
    adminMandateController.skipInstallment
);
router.post(
    "/mandate-installments/:id/retry",
    adminMandateValidator.installmentId,
    adminMandateValidator.retryInstallment,
    validate,
    adminMandateController.retryInstallment
);

router.get(
    "/mandate-transactions",
    adminMandateValidator.listTransactions,
    validate,
    adminMandateController.getTransactions
);
router.get(
    "/mandate-webhooks",
    adminMandateValidator.listWebhooks,
    validate,
    adminMandateController.getWebhookLogs
);
router.get(
    "/mandate-api-logs",
    adminMandateValidator.listApiLogs,
    validate,
    adminMandateController.getApiLogs
);

// ── Website Content Management ──────────────────────────────────
router.get("/website/pages", adminWebsiteController.getPages);
router.post("/website/pages/seed", adminWebsiteController.seedDefaultPages);
router.get(
    "/website/pages/:id",
    adminWebsiteValidator.pageIdParam,
    validate,
    adminWebsiteController.getPageById
);
router.post(
    "/website/pages",
    adminWebsiteValidator.createPage,
    validate,
    adminWebsiteController.createPage
);
router.put(
    "/website/pages/:id",
    adminWebsiteValidator.updatePage,
    validate,
    adminWebsiteController.updatePage
);
router.delete(
    "/website/pages/:id",
    adminWebsiteValidator.pageIdParam,
    validate,
    adminWebsiteController.deletePage
);

router.put(
    "/website/pages/:id/sections",
    adminWebsiteValidator.pageIdParam,
    validate,
    adminWebsiteController.updateSections
);
router.put(
    "/website/pages/:id/sections/upsert",
    adminWebsiteValidator.upsertSection,
    validate,
    adminWebsiteController.upsertSection
);
router.delete(
    "/website/pages/:id/sections/:sectionKey",
    adminWebsiteValidator.deleteSection,
    validate,
    adminWebsiteController.deleteSection
);
router.patch(
    "/website/pages/:id/sections/reorder",
    adminWebsiteValidator.reorderSections,
    validate,
    adminWebsiteController.reorderSections
);

router.get("/website/media", adminWebsiteController.getMedia);
router.post(
    "/website/media/upload",
    uploadWebsiteMedia,
    adminWebsiteController.uploadMedia
);
router.delete(
    "/website/media/:id",
    adminWebsiteValidator.mediaIdParam,
    validate,
    adminWebsiteController.deleteMedia
);

module.exports = router;

