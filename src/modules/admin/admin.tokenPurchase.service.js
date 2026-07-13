const User = require("../user/user.model");
const UserProfile = require("../user/userProfile.model");
const TokenPurchase = require("../creditToken/tokenPurchase.model");
const { formatTokenPurchase } = require("../creditToken/tokenPurchase.mapper");
const ApiError = require("../../utils/ApiError");

const SORTABLE_FIELDS = {
    purchasedAt: "purchasedAt",
    price: "price",
    quantity: "quantity",
    tokenType: "tokenType",
    status: "status",
    createdAt: "createdAt",
};

const buildProfileMap = async (purchases) => {
    const userIds = purchases
        .map((item) => item.user?._id?.toString())
        .filter(Boolean);

    if (!userIds.length) {
        return {};
    }

    const profiles = await UserProfile.find({ user: { $in: userIds } });

    return Object.fromEntries(
        profiles.map((profile) => [profile.user.toString(), profile])
    );
};

exports.getTokenPurchases = async (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.userId) {
        filter.user = query.userId;
    }

    if (query.tokenType) {
        filter.tokenType = query.tokenType;
    }

    if (query.status) {
        filter.status = query.status;
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

        const userIds = users.map((user) => user._id);

        filter.$or = [
            { planTitle: { $regex: search, $options: "i" } },
            { transactionId: { $regex: search, $options: "i" } },
            { user: { $in: userIds } },
        ];
    }

    const sortField =
        SORTABLE_FIELDS[query.sortBy] || SORTABLE_FIELDS.purchasedAt;
    const sortDir = query.sortOrder === "asc" ? 1 : -1;

    const [purchases, total, successCount, pendingCount, failedCount] =
        await Promise.all([
            TokenPurchase.find(filter)
                .populate("user", "mobile email")
                .sort({ [sortField]: sortDir })
                .skip(skip)
                .limit(limit),
            TokenPurchase.countDocuments(filter),
            TokenPurchase.countDocuments({ status: "SUCCESS" }),
            TokenPurchase.countDocuments({ status: "PENDING" }),
            TokenPurchase.countDocuments({ status: "FAILED" }),
        ]);

    const profileMap = await buildProfileMap(purchases);

    return {
        purchases: purchases.map((item) =>
            formatTokenPurchase(item, profileMap)
        ),
        stats: {
            total,
            successCount,
            pendingCount,
            failedCount,
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getTokenPurchaseById = async (purchaseId) => {
    const purchase = await TokenPurchase.findById(purchaseId).populate(
        "user",
        "mobile email"
    );

    if (!purchase) {
        throw new ApiError(404, "Token purchase not found");
    }

    const profileMap = await buildProfileMap([purchase]);

    return formatTokenPurchase(purchase, profileMap);
};
