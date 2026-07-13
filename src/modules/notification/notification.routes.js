const express = require("express");

const notificationController = require("./notification.controller");
const auth = require("../../middleware/auth.middleware");

const router = express.Router();

router.use(auth);

router.get("/", notificationController.getMyNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);

module.exports = router;
