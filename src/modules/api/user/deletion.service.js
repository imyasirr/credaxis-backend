const AccountDeletionRequest = require("./deletionRequest.model");
const User = require("./model");
const UserProfile = require("./profile.model");
const Role = require("../../role/model");
const ROLES = require("../../../constants/roles");
const notificationService = require("../notification/service");
const ApiError = require("../../../utils/ApiError");

const formatRequest = (doc, extras = {}) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;
    const user = data.user;

    return {
        id: data._id,
        status: data.status,
        reason: data.reason || "",
        adminRemarks: data.adminRemarks || "",
        processedAt: data.processedAt || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        user:
            user && typeof user === "object" && user._id
                ? {
                      id: user._id,
                      mobile: user.mobile || "",
                      email: user.email || "",
                      status: user.status || "",
                      isDeleted: Boolean(user.isDeleted),
                  }
                : { id: user },
        processedBy:
            data.processedBy &&
            typeof data.processedBy === "object" &&
            data.processedBy._id
                ? {
                      id: data.processedBy._id,
                      mobile: data.processedBy.mobile || "",
                      email: data.processedBy.email || "",
                  }
                : data.processedBy
                  ? { id: data.processedBy }
                  : null,
        ...extras,
    };
};

const attachProfileName = async (formattedList) => {
    const userIds = formattedList
        .map((r) => r.user?.id)
        .filter(Boolean)
        .map(String);
    if (!userIds.length) return formattedList;

    const profiles = await UserProfile.find({ user: { $in: userIds } }).select(
        "user firstName lastName"
    );
    const map = Object.fromEntries(
        profiles.map((p) => [
            String(p.user),
            [p.firstName, p.lastName].filter(Boolean).join(" ").trim(),
        ])
    );

    return formattedList.map((r) => ({
        ...r,
        user: {
            ...r.user,
            fullName: map[String(r.user.id)] || "",
        },
    }));
};

/** Soft-delete user account (shared by admin direct delete + approve request). */
exports.softDeleteUserAccount = async (userId) => {
    const user = await User.findOne({ _id: userId, isDeleted: false });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const adminRole = await Role.findOne({ name: ROLES.ADMIN });
    if (
        adminRole &&
        user.role &&
        user.role.toString() === adminRole._id.toString()
    ) {
        throw new ApiError(400, "Cannot delete admin account");
    }

    const originalMobile = user.mobile;

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.status = "INACTIVE";

    const prefix = `deleted_${user._id}_`;
    user.mobile = prefix + originalMobile;
    if (user.email) {
        user.email = prefix + user.email;
    }

    await user.save();

    return { id: user._id, mobile: originalMobile };
};

exports.requestDeletion = async (userId, body = {}) => {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const existing = await AccountDeletionRequest.findOne({
        user: userId,
        status: "PENDING",
    });
    if (existing) {
        throw new ApiError(
            400,
            "You already have a pending account deletion request"
        );
    }

    const reason = String(body.reason || "").trim();

    const doc = await AccountDeletionRequest.create({
        user: userId,
        reason,
        status: "PENDING",
    });

    await notificationService.notifySafe(userId, {
        title: "Deletion request received",
        message:
            "Your account deletion request is pending admin review. You can cancel it anytime before approval.",
        type: "INFO",
    });

    return formatRequest(doc);
};

exports.getMyDeletionRequest = async (userId) => {
    const doc = await AccountDeletionRequest.findOne({ user: userId }).sort({
        createdAt: -1,
    });
    if (!doc) {
        return { request: null };
    }
    return { request: formatRequest(doc) };
};

exports.cancelDeletionRequest = async (userId) => {
    const doc = await AccountDeletionRequest.findOne({
        user: userId,
        status: "PENDING",
    });
    if (!doc) {
        throw new ApiError(404, "No pending deletion request found");
    }

    doc.status = "CANCELLED";
    doc.processedAt = new Date();
    await doc.save();

    await notificationService.notifySafe(userId, {
        title: "Deletion request cancelled",
        message: "Your account deletion request was cancelled.",
        type: "INFO",
    });

    return formatRequest(doc);
};

exports.listDeletionRequests = async (query = {}) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.status) {
        filter.status = String(query.status).toUpperCase();
    }
    if (query.search) {
        const s = String(query.search).trim();
        const users = await User.find({
            $or: [
                { mobile: { $regex: s, $options: "i" } },
                { email: { $regex: s, $options: "i" } },
            ],
        }).select("_id");
        filter.user = { $in: users.map((u) => u._id) };
    }

    const [items, total] = await Promise.all([
        AccountDeletionRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("user", "mobile email status isDeleted")
            .populate("processedBy", "mobile email"),
        AccountDeletionRequest.countDocuments(filter),
    ]);

    let requests = items.map((d) => formatRequest(d));
    requests = await attachProfileName(requests);

    return {
        requests,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getDeletionRequestById = async (id) => {
    const doc = await AccountDeletionRequest.findById(id)
        .populate("user", "mobile email status isDeleted")
        .populate("processedBy", "mobile email");
    if (!doc) {
        throw new ApiError(404, "Deletion request not found");
    }
    const [formatted] = await attachProfileName([formatRequest(doc)]);
    return formatted;
};

exports.approveDeletionRequest = async (id, adminId, body = {}) => {
    const doc = await AccountDeletionRequest.findById(id);
    if (!doc) {
        throw new ApiError(404, "Deletion request not found");
    }
    if (doc.status !== "PENDING") {
        throw new ApiError(
            400,
            `Only PENDING requests can be approved (current: ${doc.status})`
        );
    }

    const remarks = String(body.remarks || body.adminRemarks || "").trim();

    await notificationService.notifySafe(doc.user, {
        title: "Account deletion approved",
        message:
            "Your account deletion request was approved. Your account has been deactivated.",
        type: "WARNING",
    });

    await exports.softDeleteUserAccount(doc.user);

    doc.status = "APPROVED";
    doc.adminRemarks = remarks;
    doc.processedBy = adminId;
    doc.processedAt = new Date();
    await doc.save();

    const populated = await AccountDeletionRequest.findById(doc._id)
        .populate("user", "mobile email status isDeleted")
        .populate("processedBy", "mobile email");

    const [formatted] = await attachProfileName([formatRequest(populated)]);
    return formatted;
};

exports.rejectDeletionRequest = async (id, adminId, body = {}) => {
    const doc = await AccountDeletionRequest.findById(id);
    if (!doc) {
        throw new ApiError(404, "Deletion request not found");
    }
    if (doc.status !== "PENDING") {
        throw new ApiError(
            400,
            `Only PENDING requests can be rejected (current: ${doc.status})`
        );
    }

    const remarks = String(body.remarks || body.adminRemarks || "").trim();
    if (!remarks) {
        throw new ApiError(400, "remarks is required when rejecting");
    }

    doc.status = "REJECTED";
    doc.adminRemarks = remarks;
    doc.processedBy = adminId;
    doc.processedAt = new Date();
    await doc.save();

    await notificationService.notifySafe(doc.user, {
        title: "Account deletion rejected",
        message: `Your deletion request was rejected. ${remarks}`,
        type: "INFO",
    });

    const populated = await AccountDeletionRequest.findById(doc._id)
        .populate("user", "mobile email status isDeleted")
        .populate("processedBy", "mobile email");

    const [formatted] = await attachProfileName([formatRequest(populated)]);
    return formatted;
};
