const User = require("../user/model");
const UserProfile = require("../user/profile.model");
const Notification = require("../notification/model");

const ApiError = require("../../utils/ApiError");

const SORTABLE_FIELDS = {
    createdAt: "createdAt",
    type: "type",
    isRead: "isRead",
    title: "title",
};

const formatAdminNotification = (notification, profileMap = {}) => {
    const data = notification.toObject ? notification.toObject() : notification;
    const user = data.user;
    const userId = user?._id?.toString() || user?.toString();
    const profile = profileMap[userId];

    return {
        id: data._id,
        title: data.title,
        message: data.message,
        type: data.type,
        isRead: data.isRead,
        createdAt: data.createdAt,
        user: user
            ? {
                  id: user._id || user,
                  mobile: user.mobile || "",
                  email: user.email || "",
                  fullName: profile
                      ? [profile.firstName, profile.lastName]
                            .filter(Boolean)
                            .join(" ")
                      : "",
              }
            : null,
    };
};

exports.getNotifications = async (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.type) {
        filter.type = query.type;
    }

    if (query.isRead === "true") {
        filter.isRead = true;
    } else if (query.isRead === "false") {
        filter.isRead = false;
    }

    if (query.search) {
        const search = query.search.trim();
        const users = await User.find({
            $or: [
                { mobile: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ],
            isDeleted: false,
        }).select("_id");

        const userIds = users.map((u) => u._id);

        filter.$or = [
            { title: { $regex: search, $options: "i" } },
            { message: { $regex: search, $options: "i" } },
            { user: { $in: userIds } },
        ];
    }

    const sortField =
        SORTABLE_FIELDS[query.sortBy] || SORTABLE_FIELDS.createdAt;
    const sortDir = query.sortOrder === "asc" ? 1 : -1;

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
            .populate("user", "mobile email")
            .sort({ [sortField]: sortDir })
            .skip(skip)
            .limit(limit),
        Notification.countDocuments(filter),
        Notification.countDocuments({ isRead: false }),
    ]);

    const userIds = notifications
        .map((n) => n.user?._id?.toString())
        .filter(Boolean);

    const profiles = await UserProfile.find({ user: { $in: userIds } });
    const profileMap = Object.fromEntries(
        profiles.map((p) => [p.user.toString(), p])
    );

    return {
        notifications: notifications.map((n) =>
            formatAdminNotification(n, profileMap)
        ),
        stats: { unreadCount, total },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getNotificationById = async (notificationId) => {
    const notification = await Notification.findById(notificationId).populate(
        "user",
        "mobile email"
    );

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    const profile = await UserProfile.findOne({ user: notification.user._id });

    return formatAdminNotification(notification, {
        [notification.user._id.toString()]: profile,
    });
};

exports.deleteNotification = async (notificationId) => {
    const notification = await Notification.findByIdAndDelete(notificationId);

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    return { id: notification._id, title: notification.title };
};

exports.sendToUser = async ({ userId, title, message, type = "INFO" }) => {
    if (!userId) {
        throw new ApiError(400, "User id is required");
    }

    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const cleanTitle = String(title || "").trim();
    const cleanMessage = String(message || "").trim();

    if (!cleanTitle) {
        throw new ApiError(400, "Title is required");
    }
    if (!cleanMessage) {
        throw new ApiError(400, "Message is required");
    }

    const allowedTypes = ["INFO", "SUCCESS", "WARNING", "ERROR"];
    const cleanType = String(type || "INFO").toUpperCase();
    if (!allowedTypes.includes(cleanType)) {
        throw new ApiError(400, "Invalid notification type");
    }

    const notification = await Notification.create({
        user: user._id,
        title: cleanTitle,
        message: cleanMessage,
        type: cleanType,
    });

    const profile = await UserProfile.findOne({ user: user._id });

    return formatAdminNotification(
        await Notification.findById(notification._id).populate(
            "user",
            "mobile email"
        ),
        { [user._id.toString()]: profile }
    );
};
