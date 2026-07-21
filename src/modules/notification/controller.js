const notificationService = require("./service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getMyNotifications = asyncHandler(async (req, res) => {
    const data = await notificationService.getMyNotifications(
        req.user.id,
        req.query
    );
    return response.success(res, "Notifications fetched successfully", data);
});

exports.getUnreadCount = asyncHandler(async (req, res) => {
    const data = await notificationService.getUnreadCount(req.user.id);
    return response.success(res, "Unread count fetched", data);
});

exports.getNotificationById = asyncHandler(async (req, res) => {
    const data = await notificationService.getNotificationById(
        req.user.id,
        req.params.id
    );
    return response.success(res, "Notification fetched", data);
});

exports.markAsRead = asyncHandler(async (req, res) => {
    const data = await notificationService.markAsRead(
        req.user.id,
        req.params.id
    );
    return response.success(res, "Notification marked as read", data);
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
    const data = await notificationService.markAllAsRead(req.user.id);
    return response.success(res, "All notifications marked as read", data);
});

exports.deleteNotification = asyncHandler(async (req, res) => {
    const data = await notificationService.deleteNotification(
        req.user.id,
        req.params.id
    );
    return response.success(res, "Notification deleted", data);
});
