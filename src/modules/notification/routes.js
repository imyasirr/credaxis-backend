const express = require("express");

const notificationController = require("./controller");
const notificationValidator = require("./validator");
const auth = require("../../middleware/auth.middleware");
const requireAction = require("../../middleware/requireAction.middleware");
const validate = require("../../middleware/validation.middleware");
const { ACTIONS } = require("../../constants/userStatusPolicy");

const router = express.Router();

router.use(auth);

router.get(
    "/",
    requireAction(ACTIONS.NOTIFICATIONS_READ),
    notificationValidator.getMyNotifications,
    validate,
    notificationController.getMyNotifications
);

router.get(
    "/unread-count",
    requireAction(ACTIONS.NOTIFICATIONS_READ),
    notificationController.getUnreadCount
);

router.patch(
    "/read-all",
    requireAction(ACTIONS.NOTIFICATIONS_WRITE),
    notificationController.markAllAsRead
);

router.get(
    "/:id",
    requireAction(ACTIONS.NOTIFICATIONS_READ),
    notificationValidator.notificationId,
    validate,
    notificationController.getNotificationById
);

router.patch(
    "/:id/read",
    requireAction(ACTIONS.NOTIFICATIONS_WRITE),
    notificationValidator.notificationId,
    validate,
    notificationController.markAsRead
);

router.delete(
    "/:id",
    requireAction(ACTIONS.NOTIFICATIONS_WRITE),
    notificationValidator.notificationId,
    validate,
    notificationController.deleteNotification
);

module.exports = router;
