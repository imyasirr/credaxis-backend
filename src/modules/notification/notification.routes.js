const express = require("express");

const notificationController = require("./notification.controller");
const notificationValidator = require("./notification.validator");
const auth = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validation.middleware");

const router = express.Router();

router.use(auth);

// Works for both USER and PARTNER (same logged-in user id)
router.get(
    "/",
    notificationValidator.getMyNotifications,
    validate,
    notificationController.getMyNotifications
);

router.get("/unread-count", notificationController.getUnreadCount);

router.patch("/read-all", notificationController.markAllAsRead);

router.get(
    "/:id",
    notificationValidator.notificationId,
    validate,
    notificationController.getNotificationById
);

router.patch(
    "/:id/read",
    notificationValidator.notificationId,
    validate,
    notificationController.markAsRead
);

router.delete(
    "/:id",
    notificationValidator.notificationId,
    validate,
    notificationController.deleteNotification
);

module.exports = router;
