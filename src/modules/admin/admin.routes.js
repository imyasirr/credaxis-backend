const express = require("express");

const adminController = require("./admin.controller");
const adminWalletController = require("./admin.wallet.controller");
const adminNotificationController = require("./admin.notification.controller");
const adminValidator = require("./admin.validator");
const adminWalletValidator = require("./admin.wallet.validator");
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

module.exports = router;
