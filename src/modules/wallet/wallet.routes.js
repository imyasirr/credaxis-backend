const express = require("express");

const walletController = require("./wallet.controller");
const walletValidator = require("./wallet.validator");
const auth = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validation.middleware");

const router = express.Router();

router.use(auth);

router.get("/", walletController.getMyWallet);
router.get("/transactions", walletController.getTransactions);
router.post(
    "/add-money",
    walletValidator.addMoney,
    validate,
    walletController.addMoney
);

router.get("/beneficiaries", walletController.getBeneficiaries);
router.post(
    "/beneficiaries",
    walletValidator.beneficiary,
    validate,
    walletController.addBeneficiary
);
router.put(
    "/beneficiaries/:id",
    walletValidator.updateBeneficiary,
    validate,
    walletController.updateBeneficiary
);
router.delete("/beneficiaries/:id", walletController.deleteBeneficiary);

module.exports = router;
