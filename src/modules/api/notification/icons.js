/**
 * Notification icons — static PNGs served from /uploads/notification-icons/
 * Frontend: use `icon` as <img src={icon} /> (same-origin or prepend API host).
 */
const TYPE_ICON_FILES = {
    INFO: "info.png",
    SUCCESS: "success.png",
    WARNING: "warning.png",
    ERROR: "error.png",
    REWARD: "reward.png",
};

const ICONS_BASE_PATH = "/uploads/notification-icons";

/**
 * Absolute or relative icon URL for a notification type.
 * Optional stored `icon` (filename or full path) overrides type default.
 */
exports.resolveNotificationIconUrl = (notification = {}) => {
    const type = String(notification.type || "INFO").toUpperCase();
    const stored = notification.icon ? String(notification.icon).trim() : "";

    if (stored) {
        if (/^https?:\/\//i.test(stored) || stored.startsWith("/")) {
            return stored;
        }
        return `${ICONS_BASE_PATH}/${stored.replace(/^\/+/, "")}`;
    }

    const file = TYPE_ICON_FILES[type] || TYPE_ICON_FILES.INFO;
    return `${ICONS_BASE_PATH}/${file}`;
};

exports.TYPE_ICON_FILES = TYPE_ICON_FILES;
exports.ICONS_BASE_PATH = ICONS_BASE_PATH;
exports.NOTIFICATION_TYPES = Object.keys(TYPE_ICON_FILES);
