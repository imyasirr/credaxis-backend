const User = require("../user/model");
const UserProfile = require("../user/profile.model");
const Partner = require("../partner/model");
const Kyc = require("../kyc/model");
const kycRepository = require("../kyc/repository");
const Wallet = require("../wallet/model");
const WalletTransaction = require("../wallet/transaction.model");
const Role = require("../role/model");
const ROLES = require("../../constants/roles");

const ApiError = require("../../utils/ApiError");
const MESSAGES = require("../../constants/messages");
const { hash, compare } = require("../../utils/password");
const { generateAccessToken } = require("../../utils/jwt");
const notificationService = require("../notification/service");
const {
    getAvatarPath,
    deleteAvatarFile,
} = require("../../middleware/upload.middleware");

const formatAdmin = (user, profile) => {
    const fullName =
        [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
        "Admin";

    return {
        id: user._id,
        email: user.email,
        mobile: user.mobile,
        role: user.role?.name || user.role,
        firstName: profile?.firstName || "Admin",
        lastName: profile?.lastName || "",
        fullName,
        avatar: profile?.avatar || null,
    };
};

exports.login = async (email, password) => {
    const user = await User.findOne({
        email: email.trim().toLowerCase(),
        isDeleted: false,
    })
        .select("+password")
        .populate("role");

    if (!user || !user.password) {
        throw new ApiError(401, MESSAGES.INVALID_CREDENTIALS);
    }

    if (user.role?.name !== ROLES.ADMIN) {
        throw new ApiError(403, "Admin access only");
    }

    if (user.status !== "ACTIVE") {
        throw new ApiError(403, "Account is not active");
    }

    const isMatch = await compare(password, user.password);

    if (!isMatch) {
        throw new ApiError(401, MESSAGES.INVALID_CREDENTIALS);
    }

    user.lastLogin = new Date();
    user.failedLoginAttempts = 0;
    await user.save();

    const profile = await UserProfile.findOne({ user: user._id });

    return {
        token: generateAccessToken({
            id: user._id,
            role: user.role.name,
        }),
        admin: formatAdmin(user, profile),
    };
};

exports.getDashboard = async () => {
    const adminRole = await Role.findOne({ name: ROLES.ADMIN });

    const [
        totalUsers,
        totalPartners,
        pendingKyc,
        pendingPartners,
        totalTransactions,
        walletAgg,
        roleBreakdown,
    ] = await Promise.all([
        User.countDocuments({ isDeleted: false }),
        Partner.countDocuments({ status: "APPROVED" }),
        kycRepository.countPendingForActiveUsers(adminRole?._id || null),
        Partner.countDocuments({ status: "PENDING" }),
        WalletTransaction.countDocuments(),
        Wallet.aggregate([
            {
                $group: {
                    _id: null,
                    totalBalance: { $sum: "$availableBalance" },
                },
            },
        ]),
        Role.aggregate([
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "role",
                    as: "users",
                },
            },
            {
                $project: {
                    name: 1,
                    count: {
                        $size: {
                            $filter: {
                                input: "$users",
                                as: "u",
                                cond: { $ne: ["$$u.isDeleted", true] },
                            },
                        },
                    },
                },
            },
        ]),
    ]);

    return {
        stats: {
            totalUsers,
            totalPartners,
            pendingKyc,
            pendingPartnerApplications: pendingPartners,
            totalTransactions,
            totalWalletBalance: walletAgg[0]?.totalBalance || 0,
        },
        roleBreakdown: roleBreakdown.map((r) => ({
            role: r.name,
            count: r.count,
        })),
    };
};

exports.getUsers = async (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = { isDeleted: false };

    const adminRole = await Role.findOne({ name: ROLES.ADMIN });

    if (adminRole) {
        filter.role = { $ne: adminRole._id };
    }

    if (query.status) {
        filter.status = query.status;
    }

    if (query.search) {
        filter.mobile = { $regex: query.search, $options: "i" };
    }

    const kycStatus = String(query.kycStatus || "").trim().toUpperCase();
    if (kycStatus) {
        if (kycStatus === "NOT_SUBMITTED") {
            const submittedUserIds = await Kyc.distinct("user");
            filter._id = { ...(filter._id || {}), $nin: submittedUserIds };
        } else {
            const matchingUserIds = await Kyc.find({
                status: kycStatus,
            }).distinct("user");
            filter._id = { ...(filter._id || {}), $in: matchingUserIds };
        }
    }

    const [users, total] = await Promise.all([
        User.find(filter)
            .populate("role", "name displayName")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("-password"),
        User.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);

    const profiles = await UserProfile.find({ user: { $in: userIds } });
    const profileMap = Object.fromEntries(
        profiles.map((p) => [p.user.toString(), p])
    );

    const kycRecords = await Kyc.find({ user: { $in: userIds } });
    const kycMap = Object.fromEntries(
        kycRecords.map((k) => {
            const uid = (k.user?._id || k.user)?.toString();
            return [uid, k];
        })
    );

    return {
        users: users.map((user) => {
            const profile = profileMap[user._id.toString()];
            const kyc = kycMap[user._id.toString()];

            return {
                id: user._id,
                mobile: user.mobile,
                email: user.email || "",
                role: user.role?.name || user.role,
                status: user.status,
                isMobileVerified: user.isMobileVerified,
                isProfileComplete: profile?.isProfileComplete || false,
                kycStatus: kyc?.status || "NOT_SUBMITTED",
                kycId: kyc?._id || null,
                firstName: profile?.firstName || "",
                lastName: profile?.lastName || "",
                fullName: profile
                    ? [profile.firstName, profile.lastName]
                          .filter(Boolean)
                          .join(" ")
                    : "",
                createdAt: user.createdAt,
            };
        }),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
};

exports.updateUserStatus = async (userId, status, reason = null, adminId = null) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const adminRole = await Role.findOne({ name: ROLES.ADMIN });

    if (user.role.toString() === adminRole._id.toString()) {
        throw new ApiError(400, "Cannot change admin account status");
    }

    const {
        walletStatusForUserStatus,
    } = require("../../constants/userStatusPolicy");

    user.status = status;
    user.statusReason = reason || null;
    user.statusChangedAt = new Date();
    if (adminId) {
        user.statusChangedBy = adminId;
    }
    await user.save();

    const wallet = await Wallet.findOne({ user: userId });
    if (wallet) {
        wallet.status = walletStatusForUserStatus(status);
        await wallet.save();
    }

    const statusMessages = {
        ACTIVE: {
            title: "Account activated",
            message: "Your account is active again. You can use CredAxis normally.",
            type: "SUCCESS",
        },
        INACTIVE: {
            title: "Account inactive",
            message: reason
                ? `Your account was set to inactive. Reason: ${reason}`
                : "Your account was set to inactive by admin.",
            type: "WARNING",
        },
        BLOCKED: {
            title: "Account blocked",
            message: reason
                ? `Your account was blocked. Reason: ${reason}`
                : "Your account was blocked by admin.",
            type: "ERROR",
        },
        SUSPENDED: {
            title: "Account suspended",
            message: reason
                ? `Your account was suspended. Reason: ${reason}`
                : "Your account was suspended by admin.",
            type: "ERROR",
        },
    };

    const payload = statusMessages[status] || {
        title: "Account status updated",
        message: `Your account status is now ${status}`,
        type: "INFO",
    };

    await notificationService.notifySafe(userId, payload);

    return {
        id: user._id,
        mobile: user.mobile,
        status: user.status,
        statusReason: user.statusReason,
        statusChangedAt: user.statusChangedAt,
        walletStatus: wallet?.status || null,
    };
};

exports.getUserById = async (userId) => {
    const user = await User.findOne({ _id: userId, isDeleted: false })
        .populate("role", "name displayName")
        .select("-password");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const [profile, kyc, wallet] = await Promise.all([
        UserProfile.findOne({ user: userId }),
        Kyc.findOne({ user: userId }),
        Wallet.findOne({ user: userId }),
    ]);

    return {
        id: user._id,
        mobile: user.mobile,
        email: user.email || "",
        role: user.role?.name || user.role,
        roleId: user.role?._id || user.role,
        status: user.status,
        statusReason: user.statusReason || null,
        statusChangedAt: user.statusChangedAt || null,
        isMobileVerified: user.isMobileVerified,
        isEmailVerified: user.isEmailVerified,
        isProfileComplete: profile?.isProfileComplete || false,
        firstName: profile?.firstName || "",
        lastName: profile?.lastName || "",
        fullName: profile
            ? [profile.firstName, profile.lastName].filter(Boolean).join(" ")
            : "",
        gender: profile?.gender || "",
        dob: profile?.dob || null,
        address: profile?.address || "",
        city: profile?.city || "",
        state: profile?.state || "",
        country: profile?.country || "India",
        pincode: profile?.pincode || "",
        avatar: profile?.avatar || null,
        kyc: kyc
            ? {
                  id: kyc._id,
                  status: kyc.status,
                  panNumber: kyc.panNumber || "",
                  aadhaarNumber: kyc.aadhaarNumber || "",
                  panImage: kyc.panImage || null,
                  aadhaarFront: kyc.aadhaarFront || null,
                  aadhaarBack: kyc.aadhaarBack || null,
                  selfie: kyc.selfie || null,
                  remarks: kyc.remarks || "",
                  verifiedAt: kyc.verifiedAt || null,
                  createdAt: kyc.createdAt || null,
                  updatedAt: kyc.updatedAt || null,
              }
            : { status: "NOT_SUBMITTED" },
        wallet: wallet
            ? {
                  walletNumber: wallet.walletNumber,
                  availableBalance: wallet.availableBalance,
                  isKycCompleted: wallet.isKycCompleted,
              }
            : null,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
    };
};

exports.updateUser = async (userId, body) => {
    const user = await User.findOne({ _id: userId, isDeleted: false });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const adminRole = await Role.findOne({ name: ROLES.ADMIN });

    if (user.role.toString() === adminRole._id.toString()) {
        throw new ApiError(400, "Cannot update admin account");
    }

    if (body.mobile !== undefined) {
        const mobile = body.mobile.trim();
        const existingMobile = await User.findOne({
            mobile,
            _id: { $ne: userId },
            isDeleted: false,
        });

        if (existingMobile) {
            throw new ApiError(400, "Mobile number already in use");
        }

        user.mobile = mobile;
    }

    if (body.email !== undefined) {
        const email = body.email?.trim().toLowerCase() || "";

        if (email) {
            const existingEmail = await User.findOne({
                email,
                _id: { $ne: userId },
                isDeleted: false,
            });

            if (existingEmail) {
                throw new ApiError(400, "Email already in use");
            }
        }

        user.email = email || undefined;
    }

    if (body.status !== undefined) {
        const {
            walletStatusForUserStatus,
        } = require("../../constants/userStatusPolicy");

        user.status = body.status;
        user.statusReason = body.statusReason || body.reason || user.statusReason;
        user.statusChangedAt = new Date();

        const wallet = await Wallet.findOne({ user: userId });
        if (wallet) {
            wallet.status = walletStatusForUserStatus(body.status);
            await wallet.save();
        }
    }

    if (body.role !== undefined) {
        const roleName = body.role.toUpperCase();

        if (![ROLES.USER, ROLES.PARTNER].includes(roleName)) {
            throw new ApiError(400, "Role must be USER or PARTNER");
        }

        const roleDoc = await Role.findOne({ name: roleName });

        if (!roleDoc) {
            throw new ApiError(400, "Role not found. Run role seeder first.");
        }

        user.role = roleDoc._id;
    }

    if (body.isEmailVerified !== undefined) {
        user.isEmailVerified = Boolean(body.isEmailVerified);
    }

    if (body.isMobileVerified !== undefined) {
        user.isMobileVerified = Boolean(body.isMobileVerified);
    }

    await user.save();

    let profile = await UserProfile.findOne({ user: userId });

    if (!profile) {
        profile = await UserProfile.create({ user: userId });
    }

    if (body.firstName !== undefined) {
        profile.firstName = body.firstName.trim();
    }

    if (body.lastName !== undefined) {
        profile.lastName = body.lastName.trim();
    }

    if (body.gender !== undefined) {
        profile.gender = body.gender || undefined;
    }

    if (body.dob !== undefined) {
        profile.dob = body.dob || null;
    }

    if (body.address !== undefined) {
        profile.address = body.address?.trim() || "";
    }

    if (body.city !== undefined) {
        profile.city = body.city?.trim() || "";
    }

    if (body.state !== undefined) {
        profile.state = body.state?.trim() || "";
    }

    if (body.country !== undefined) {
        profile.country = body.country?.trim() || "India";
    }

    if (body.pincode !== undefined) {
        profile.pincode = body.pincode?.trim() || "";
    }

    profile.isProfileComplete = Boolean(
        profile.firstName && profile.lastName
    );

    await profile.save();

    return exports.getUserById(userId);
};

exports.getRoles = async () => {
    const roles = await Role.find({
        name: { $in: [ROLES.USER, ROLES.PARTNER] },
        status: true,
    }).select("name displayName");

    return roles.map((role) => ({
        id: role._id,
        name: role.name,
        displayName: role.displayName,
    }));
};

exports.deleteUser = async (userId) => {
    const user = await User.findOne({ _id: userId, isDeleted: false });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const adminRole = await Role.findOne({ name: ROLES.ADMIN });

    if (user.role.toString() === adminRole._id.toString()) {
        throw new ApiError(400, "Cannot delete admin account");
    }

    const originalMobile = user.mobile;

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.status = "INACTIVE";

    // Free unique mobile/email so the same number can register again
    const prefix = `deleted_${user._id}_`;
    user.mobile = prefix + originalMobile;
    if (user.email) {
        user.email = prefix + user.email;
    }

    await user.save();

    return { id: user._id, mobile: originalMobile };
};

exports.getMe = async (userId) => {
    const user = await User.findById(userId)
        .populate("role", "name displayName")
        .select("-password");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.role?.name !== ROLES.ADMIN) {
        throw new ApiError(403, "Admin access only");
    }

    const profile = await UserProfile.findOne({ user: userId });

    return formatAdmin(user, profile);
};

exports.updateMe = async (userId, body = {}, file = null) => {
    const user = await User.findById(userId)
        .select("+password")
        .populate("role", "name displayName");

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found");
    }

    if (user.role?.name !== ROLES.ADMIN) {
        throw new ApiError(403, "Admin access only");
    }

    let profile = await UserProfile.findOne({ user: userId });
    if (!profile) {
        profile = await UserProfile.create({ user: userId });
    }

    if (body.firstName !== undefined) {
        profile.firstName = String(body.firstName).trim();
    }
    if (body.lastName !== undefined) {
        profile.lastName = String(body.lastName).trim();
    }

    const removeAvatar =
        body.removeAvatar === true ||
        body.removeAvatar === "true";

    if (removeAvatar) {
        if (profile.avatar) {
            deleteAvatarFile(profile.avatar);
        }
        profile.avatar = null;
    } else if (file?.filename) {
        if (profile.avatar) {
            deleteAvatarFile(profile.avatar);
        }
        profile.avatar = getAvatarPath(file.filename);
    }

    await profile.save();

    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword;

    if (newPassword) {
        if (!currentPassword) {
            throw new ApiError(400, "Current password is required");
        }
        if (!user.password) {
            throw new ApiError(400, "Password is not set for this account");
        }
        const ok = await compare(currentPassword, user.password);
        if (!ok) {
            throw new ApiError(400, "Current password is incorrect");
        }
        if (String(newPassword).length < 8) {
            throw new ApiError(400, "New password must be at least 8 characters");
        }
        user.password = await hash(newPassword);
        user.lastPasswordChangedAt = new Date();
        await user.save();
    }

    return formatAdmin(user, profile);
};

exports.deleteMyAvatar = async (userId) => {
    const user = await User.findById(userId)
        .populate("role", "name displayName")
        .select("-password");

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found");
    }

    if (user.role?.name !== ROLES.ADMIN) {
        throw new ApiError(403, "Admin access only");
    }

    let profile = await UserProfile.findOne({ user: userId });
    if (!profile) {
        profile = await UserProfile.create({ user: userId });
    }

    if (!profile.avatar) {
        throw new ApiError(400, "No profile photo to remove");
    }

    deleteAvatarFile(profile.avatar);
    profile.avatar = null;
    await profile.save();

    return formatAdmin(user, profile);
};
