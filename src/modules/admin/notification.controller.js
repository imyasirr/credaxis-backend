const adminNotificationService = require("./notification.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getNotifications = asyncHandler(async (req, res) => {
    const data = await adminNotificationService.getNotifications(req.query);
    return response.success(res, "Notifications fetched successfully", data);
});

exports.getNotificationById = asyncHandler(async (req, res) => {
    const data = await adminNotificationService.getNotificationById(
        req.params.id
    );
    return response.success(res, "Notification fetched successfully", data);
});

exports.deleteNotification = asyncHandler(async (req, res) => {
    const data = await adminNotificationService.deleteNotification(
        req.params.id
    );
    return response.success(res, "Notification deleted successfully", data);
});

exports.sendToUser = asyncHandler(async (req, res) => {
    const data = await adminNotificationService.sendToUser(req.body);
    return response.success(res, "Message sent successfully", data);
});
