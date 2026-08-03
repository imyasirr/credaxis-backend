const { resolveNotificationIconUrl } = require("./icons");

exports.formatNotification = (notification) => {
    const data = notification.toObject
        ? notification.toObject()
        : notification;

    return {
        id: data._id,
        title: data.title,
        message: data.message,
        type: data.type || "INFO",
        icon: resolveNotificationIconUrl(data),
        isRead: data.isRead,
        createdAt: data.createdAt,
    };
};
