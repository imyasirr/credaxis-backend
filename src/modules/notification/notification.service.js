const notificationRepository = require("./notification.repository");
const ApiError = require("../../utils/ApiError");
const { formatNotification } = require("./notification.mapper");

exports.create = async (userId, { title, message, type = "INFO" }) => {
    const notification = await notificationRepository.create({
        user: userId,
        title,
        message,
        type,
    });

    return formatNotification(notification);
};

exports.getMyNotifications = async (userId, query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const [notifications, total] = await Promise.all([
        notificationRepository.findByUserId(userId, { page, limit }),
        notificationRepository.countByUserId(userId),
    ]);

    return {
        notifications: notifications.map(formatNotification),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getUnreadCount = async (userId) => {
    const count = await notificationRepository.countUnread(userId);
    return { unreadCount: count };
};

exports.markAsRead = async (userId, notificationId) => {
    const notification = await notificationRepository.markAsRead(
        notificationId,
        userId
    );

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    return formatNotification(notification);
};

exports.markAllAsRead = async (userId) => {
    await notificationRepository.markAllAsRead(userId);
    return { message: "All notifications marked as read" };
};
