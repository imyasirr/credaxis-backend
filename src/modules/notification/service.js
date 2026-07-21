const notificationRepository = require("./repository");
const ApiError = require("../../utils/ApiError");
const { formatNotification } = require("./mapper");

exports.create = async (userId, { title, message, type = "INFO" }) => {
    const notification = await notificationRepository.create({
        user: userId,
        title,
        message,
        type,
    });

    return formatNotification(notification);
};

exports.getMyNotifications = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const filter = { user: userId };

    if (query.isRead !== undefined && query.isRead !== "") {
        const raw = String(query.isRead).toLowerCase();
        filter.isRead = raw === "true" || raw === "1";
    }

    if (query.type) {
        filter.type = String(query.type).toUpperCase();
    }

    const [notifications, total, unreadCount] = await Promise.all([
        notificationRepository.findByFilter(filter, { page, limit }),
        notificationRepository.countByFilter(filter),
        notificationRepository.countUnread(userId),
    ]);

    return {
        notifications: notifications.map(formatNotification),
        unreadCount,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getNotificationById = async (userId, notificationId) => {
    const notification = await notificationRepository.findOneByUser(
        notificationId,
        userId
    );

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    return formatNotification(notification);
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
    const result = await notificationRepository.markAllAsRead(userId);
    return {
        modifiedCount: result.modifiedCount || 0,
        message: "All notifications marked as read",
    };
};

exports.deleteNotification = async (userId, notificationId) => {
    const deleted = await notificationRepository.deleteByUser(
        notificationId,
        userId
    );

    if (!deleted) {
        throw new ApiError(404, "Notification not found");
    }

    return { id: notificationId, deleted: true };
};
