const express = require("express");

const walletController = require("./controller");
const walletValidator = require("./validator");
const auth = require("../../../middleware/auth.middleware");
const requireAction = require("../../../middleware/requireAction.middleware");
const validate = require("../../../middleware/validation.middleware");
const { ACTIONS } = require("../../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/",
    requireAction(ACTIONS.WALLET_READ),
    walletController.getMyWallet
);
router.get(
    "/transactions",
    requireAction(ACTIONS.WALLET_READ),
    walletController.getTransactions
);
router.post(
    "/add-money",
    requireAction(ACTIONS.WALLET_WRITE),
    walletValidator.addMoney,
    validate,
    walletController.addMoney
);
router.post(
    "/verify-payment",
    requireAction(ACTIONS.WALLET_WRITE),
    walletValidator.verifyPayment,
    validate,
    walletController.verifyAddMoney
);

router.get(
    "/beneficiaries",
    requireAction(ACTIONS.WALLET_READ),
    walletController.getBeneficiaries
);
router.post(
    "/beneficiaries",
    requireAction(ACTIONS.WALLET_WRITE),
    walletValidator.beneficiary,
    validate,
    walletController.addBeneficiary
);
router.put(
    "/beneficiaries/:id",
    requireAction(ACTIONS.WALLET_WRITE),
    walletValidator.updateBeneficiary,
    validate,
    walletController.updateBeneficiary
);
router.delete(
    "/beneficiaries/:id",
    requireAction(ACTIONS.WALLET_WRITE),
    walletController.deleteBeneficiary
);

/** Withdrawals — before any future /:id catch-alls */
router.get(
    "/withdraw/destinations",
    requireAction(ACTIONS.WALLET_READ),
    walletController.getWithdrawDestinations
);
router.post(
    "/withdraw",
    requireAction(ACTIONS.WALLET_WRITE),
    walletValidator.createWithdrawal,
    validate,
    walletController.createWithdrawal
);
router.get(
    "/withdrawals",
    requireAction(ACTIONS.WALLET_READ),
    walletValidator.listWithdrawals,
    validate,
    walletController.listMyWithdrawals
);
router.get(
    "/withdrawals/:id",
    requireAction(ACTIONS.WALLET_READ),
    walletValidator.withdrawalId,
    validate,
    walletController.getMyWithdrawalById
);
router.post(
    "/withdrawals/:id/cancel",
    requireAction(ACTIONS.WALLET_WRITE),
    walletValidator.withdrawalId,
    validate,
    walletController.cancelMyWithdrawal
);

module.exports = router;
