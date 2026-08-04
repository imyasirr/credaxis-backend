const mongoose = require("mongoose");

const Payment = require("../../api/payments/model");
const UserProfile = require("../../api/user/profile.model");
const { formatPayment } = require("../../api/payments/mapper");
const {
    PAYMENT_PURPOSES,
    PAYMENT_STATUSES,
} = require("../../../integrations/razorpay/constants");
const ApiError = require("../../../utils/ApiError");

const formatAdminPayment = (doc, profileMap = {}) => {
    const base = formatPayment(doc);
    if (!base) return null;

    const user = doc.user;
    const userId = user?._id || user;
    const profile = profileMap[String(userId)] || null;

    return {
        ...base,
        user: user
            ? {
                  id: userId,
                  mobile: user.mobile || "",
                  email: user.email || "",
                  status: user.status || "",
                  fullName: profile
                      ? [profile.firstName, profile.lastName]
                            .filter(Boolean)
                            .join(" ")
                      : "",
              }
            : null,
    };
};

const loadProfiles = async (payments) => {
    const userIds = [
        ...new Set(
            payments
                .map((p) => {
                    const u = p.user;
                    return String(u?._id || u || "");
                })
                .filter(Boolean)
        ),
    ];

    if (!userIds.length) return {};

    const profiles = await UserProfile.find({
        user: { $in: userIds },
    }).select("user firstName lastName");

    return profiles.reduce((acc, profile) => {
        acc[String(profile.user)] = profile;
        return acc;
    }, {});
};

exports.listPayments = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.purpose) {
        const purpose = String(query.purpose).toUpperCase();
        if (!Object.values(PAYMENT_PURPOSES).includes(purpose)) {
            throw new ApiError(400, "Invalid purpose filter");
        }
        filter.purpose = purpose;
    }

    if (query.status) {
        const status = String(query.status).toUpperCase();
        if (!Object.values(PAYMENT_STATUSES).includes(status)) {
            throw new ApiError(400, "Invalid status filter");
        }
        filter.status = status;
    }

    if (query.userId && mongoose.isValidObjectId(query.userId)) {
        filter.user = query.userId;
    }

    if (query.search) {
        const s = String(query.search).trim();
        const or = [
            { razorpayOrderId: { $regex: s, $options: "i" } },
            { razorpayPaymentId: { $regex: s, $options: "i" } },
            { receipt: { $regex: s, $options: "i" } },
            { description: { $regex: s, $options: "i" } },
        ];

        if (mongoose.isValidObjectId(s)) {
            or.push({ _id: s });
            or.push({ user: s });
        }

        // mobile search via users
        const User = require("../../api/user/model");
        const users = await User.find({
            mobile: { $regex: s, $options: "i" },
        })
            .select("_id")
            .limit(50);
        if (users.length) {
            or.push({ user: { $in: users.map((u) => u._id) } });
        }

        filter.$or = or;
    }

    const [payments, total, statusAgg, purposeAgg, amountAgg] =
        await Promise.all([
            Payment.find(filter)
                .populate("user", "mobile email status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Payment.countDocuments(filter),
            Payment.aggregate([
                { $match: filter },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            Payment.aggregate([
                { $match: filter },
                { $group: { _id: "$purpose", count: { $sum: 1 } } },
            ]),
            Payment.aggregate([
                {
                    $match: {
                        ...filter,
                        status: {
                            $in: [
                                PAYMENT_STATUSES.PAID,
                                PAYMENT_STATUSES.CONSUMED,
                            ],
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: "$amount" },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

    const profileMap = await loadProfiles(payments);
    const byStatus = Object.values(PAYMENT_STATUSES).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
    statusAgg.forEach((row) => {
        if (row._id) byStatus[row._id] = row.count;
    });

    const byPurpose = Object.values(PAYMENT_PURPOSES).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
    purposeAgg.forEach((row) => {
        if (row._id) byPurpose[row._id] = row.count;
    });

    return {
        payments: payments.map((doc) => formatAdminPayment(doc, profileMap)),
        stats: {
            total,
            byStatus,
            byPurpose,
            successfulAmount: amountAgg[0]?.totalAmount || 0,
            successfulCount: amountAgg[0]?.count || 0,
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
};

exports.getPaymentById = async (id) => {
    const payment = await Payment.findById(id).populate(
        "user",
        "mobile email status"
    );

    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    const profileMap = await loadProfiles([payment]);
    return formatAdminPayment(payment, profileMap);
};
