const User = require("../user/model");
const UserProfile = require("../user/profile.model");
const Role = require("../role/model");
const Notification = require("../notification/model");

const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");
const { resolveNotificationIconUrl } = require("../notification/icons");

const SORTABLE_FIELDS = {
    createdAt: "createdAt",
    type: "type",
    isRead: "isRead",
    title: "title",
};

const AUDIENCES = [
    {
        value: "ALL",
        label: "All users",
        help: "Every non-admin account (any status)",
    },
    {
        value: "ACTIVE",
        label: "Active users",
        help: "Only users with ACTIVE status",
    },
    {
        value: "INACTIVE",
        label: "Inactive users",
        help: "Only users with INACTIVE status",
    },
    {
        value: "BLOCKED",
        label: "Blocked users",
        help: "Only users with BLOCKED status",
    },
    {
        value: "SUSPENDED",
        label: "Suspended users",
        help: "Only users with SUSPENDED status",
    },
];

const ALLOWED_TYPES = ["INFO", "SUCCESS", "WARNING", "ERROR", "REWARD"];
const BATCH_SIZE = 500;

const formatAdminNotification = (notification, profileMap = {}) => {
    const data = notification.toObject ? notification.toObject() : notification;
    const user = data.user;
    const userId = user?._id?.toString() || user?.toString();
    const profile = profileMap[userId];
    const icon = resolveNotificationIconUrl(data);

    return {
        id: data._id,
        title: data.title,
        message: data.message,
        type: data.type,
        icon,
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

const cleanPayload = ({ title, message, type = "INFO" }) => {
    const cleanTitle = String(title || "").trim();
    const cleanMessage = String(message || "").trim();
    const cleanType = String(type || "INFO").toUpperCase();

    if (!cleanTitle) {
        throw new ApiError(400, "Title is required");
    }
    if (!cleanMessage) {
        throw new ApiError(400, "Message is required");
    }
    if (!ALLOWED_TYPES.includes(cleanType)) {
        throw new ApiError(400, "Invalid notification type");
    }

    return { cleanTitle, cleanMessage, cleanType };
};

const buildAudienceFilter = async (audienceRaw) => {
    const audience = String(audienceRaw || "ALL").toUpperCase();
    const allowed = AUDIENCES.map((item) => item.value);

    if (!allowed.includes(audience)) {
        throw new ApiError(400, "Invalid audience filter");
    }

    const adminRole = await Role.findOne({ name: ROLES.ADMIN }).select("_id");
    const filter = { isDeleted: false };

    if (adminRole) {
        filter.role = { $ne: adminRole._id };
    }

    if (audience !== "ALL") {
        filter.status = audience;
    }

    return { audience, filter };
};

exports.getAudiences = async () => {
    const adminRole = await Role.findOne({ name: ROLES.ADMIN }).select("_id");
    const base = { isDeleted: false };
    if (adminRole) {
        base.role = { $ne: adminRole._id };
    }

    const counts = await Promise.all(
        AUDIENCES.map(async (item) => {
            const filter =
                item.value === "ALL"
                    ? { ...base }
                    : { ...base, status: item.value };
            const count = await User.countDocuments(filter);
            return { ...item, count };
        })
    );

    return counts;
};

exports.previewBroadcast = async (audience) => {
    const { audience: resolved, filter } = await buildAudienceFilter(audience);
    const count = await User.countDocuments(filter);
    const meta = AUDIENCES.find((item) => item.value === resolved);

    return {
        audience: resolved,
        label: meta?.label || resolved,
        count,
    };
};

exports.getNotifications = async (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
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

    const { cleanTitle, cleanMessage, cleanType } = cleanPayload({
        title,
        message,
        type,
    });

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

exports.broadcast = async ({ audience, title, message, type = "INFO" }) => {
    const { audience: resolved, filter } = await buildAudienceFilter(audience);
    const { cleanTitle, cleanMessage, cleanType } = cleanPayload({
        title,
        message,
        type,
    });

    const users = await User.find(filter).select("_id").lean();

    if (!users.length) {
        throw new ApiError(400, "No users match this audience filter");
    }

    const now = new Date();
    const docs = users.map((user) => ({
        user: user._id,
        title: cleanTitle,
        message: cleanMessage,
        type: cleanType,
        isRead: false,
        createdAt: now,
        updatedAt: now,
    }));

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        await Notification.insertMany(docs.slice(i, i + BATCH_SIZE), {
            ordered: false,
        });
    }

    const meta = AUDIENCES.find((item) => item.value === resolved);

    return {
        audience: resolved,
        label: meta?.label || resolved,
        sentCount: users.length,
        title: cleanTitle,
        type: cleanType,
    };
};
