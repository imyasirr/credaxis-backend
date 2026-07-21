const User = require("../user/model");
const UserProfile = require("../user/profile.model");
const CoinWallet = require("../coins/model");
const CoinTransaction = require("../coins/transaction.model");
const Role = require("../role/model");
const coinService = require("../coins/service");
const ROLES = require("../../constants/roles");
const ApiError = require("../../utils/ApiError");
const {
    formatCoinWallet,
    formatCoinTransaction,
} = require("../coins/mapper");

const formatAdminCoinWallet = (wallet, profileMap = {}) => {
    const data = wallet.toObject ? wallet.toObject() : wallet;
    const user = data.user;
    const userId = user?._id?.toString() || user?.toString();
    const profile = profileMap[userId];

    return {
        id: data._id,
        coinAccountNumber: data.coinAccountNumber,
        availableBalance: data.availableBalance,
        totalBalance: data.totalBalance,
        lifetimeEarned: data.lifetimeEarned,
        lifetimeSpent: data.lifetimeSpent,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        user: user
            ? {
                  id: user._id || user,
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

const SORTABLE_FIELDS = {
    coinAccountNumber: "coinAccountNumber",
    availableBalance: "availableBalance",
    lifetimeEarned: "lifetimeEarned",
    status: "status",
    createdAt: "createdAt",
};

exports.getCoinWallets = async (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.status) {
        filter.status = query.status;
    }

    if (query.search) {
        const search = query.search.trim();
        const users = await User.find({
            mobile: { $regex: search, $options: "i" },
            isDeleted: false,
        }).select("_id");

        filter.$or = [
            { coinAccountNumber: { $regex: search, $options: "i" } },
            { user: { $in: users.map((u) => u._id) } },
        ];
    }

    const sortField =
        SORTABLE_FIELDS[query.sortBy] || SORTABLE_FIELDS.createdAt;
    const sortDir = query.sortOrder === "asc" ? 1 : -1;

    const [wallets, total] = await Promise.all([
        CoinWallet.find(filter)
            .populate("user", "mobile email status")
            .sort({ [sortField]: sortDir })
            .skip(skip)
            .limit(limit),
        CoinWallet.countDocuments(filter),
    ]);

    const userIds = wallets
        .map((w) => w.user?._id?.toString())
        .filter(Boolean);

    const profiles = await UserProfile.find({ user: { $in: userIds } });
    const profileMap = Object.fromEntries(
        profiles.map((p) => [p.user.toString(), p])
    );

    return {
        coinWallets: wallets.map((w) => formatAdminCoinWallet(w, profileMap)),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getCoinWalletById = async (walletId) => {
    const wallet = await CoinWallet.findById(walletId).populate(
        "user",
        "mobile email status"
    );

    if (!wallet) {
        throw new ApiError(404, "Coin account not found");
    }

    const profile = await UserProfile.findOne({ user: wallet.user._id });

    const [transactions, transactionCount] = await Promise.all([
        CoinTransaction.find({ coinWallet: walletId })
            .sort({ createdAt: -1 })
            .limit(20),
        CoinTransaction.countDocuments({ coinWallet: walletId }),
    ]);

    return {
        ...formatAdminCoinWallet(wallet, {
            [wallet.user._id.toString()]: profile,
        }),
        transactions: transactions.map(formatCoinTransaction),
        transactionCount,
    };
};

exports.createCoinWallet = async ({ mobile, userId, initialBalance = 0 }) => {
    let user;

    if (userId) {
        user = await User.findOne({ _id: userId, isDeleted: false });
    } else if (mobile) {
        user = await User.findOne({
            mobile: mobile.trim(),
            isDeleted: false,
        });
    } else {
        throw new ApiError(400, "User ID or mobile is required");
    }

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const adminRole = await Role.findOne({ name: ROLES.ADMIN });

    if (user.role.toString() === adminRole._id.toString()) {
        throw new ApiError(400, "Cannot create coin account for admin");
    }

    const existing = await CoinWallet.findOne({ user: user._id });

    if (existing) {
        throw new ApiError(400, "Coin account already exists for this user");
    }

    await coinService.getOrCreateWallet(user._id);

    const balance = Math.max(0, Number(initialBalance) || 0);

    if (balance > 0) {
        await coinService.creditCoins(user._id, {
            amount: balance,
            source: "ADMIN",
            description: "Initial coin balance by admin",
            notify: false,
        });
    }

    const wallet = await CoinWallet.findOne({ user: user._id });
    return exports.getCoinWalletById(wallet._id);
};

exports.updateCoinWallet = async (walletId, body) => {
    const wallet = await CoinWallet.findById(walletId);

    if (!wallet) {
        throw new ApiError(404, "Coin account not found");
    }

    if (body.status !== undefined) {
        wallet.status = body.status;
    }

    await wallet.save();
    return exports.getCoinWalletById(walletId);
};

exports.adjustBalance = async (walletId, { type, amount, description }) => {
    const wallet = await CoinWallet.findById(walletId);

    if (!wallet) {
        throw new ApiError(404, "Coin account not found");
    }

    const value = Number(amount);

    if (!value || value <= 0) {
        throw new ApiError(400, "Amount must be greater than 0");
    }

    if (type === "CREDIT") {
        await coinService.creditCoins(
            wallet.user,
            {
                amount: value,
                source: "ADMIN",
                description: description || "Admin coin credit",
                notify: true,
            }
        );
    } else if (type === "DEBIT") {
        await coinService.debitCoins(wallet.user, {
            amount: value,
            source: "ADMIN",
            description: description || "Admin coin debit",
        });
    } else {
        throw new ApiError(400, "Type must be CREDIT or DEBIT");
    }

    return exports.getCoinWalletById(walletId);
};

exports.deleteCoinWallet = async (walletId) => {
    const wallet = await CoinWallet.findById(walletId);

    if (!wallet) {
        throw new ApiError(404, "Coin account not found");
    }

    wallet.status = "BLOCKED";
    await wallet.save();

    return {
        id: wallet._id,
        coinAccountNumber: wallet.coinAccountNumber,
        status: wallet.status,
    };
};
