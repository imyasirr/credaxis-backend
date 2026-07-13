const adminNotificationService = require("./admin.notification.service");

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
