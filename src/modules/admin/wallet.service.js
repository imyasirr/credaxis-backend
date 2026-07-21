const mongoose = require("mongoose");

const User = require("../user/model");
const UserProfile = require("../user/profile.model");
const Wallet = require("../wallet/model");
const WalletTransaction = require("../wallet/transaction.model");
const Role = require("../role/model");
const ROLES = require("../../constants/roles");

const ApiError = require("../../utils/ApiError");
const {
    formatWallet,
    formatTransaction,
} = require("../wallet/mapper");

const generateWalletNumber = () =>
    "WAL" + Date.now() + Math.floor(Math.random() * 1000);

const generateTransactionId = () =>
    "TXN" + Date.now() + Math.floor(Math.random() * 1000);

const formatAdminWallet = (wallet, profileMap = {}) => {
    const data = wallet.toObject ? wallet.toObject() : wallet;
    const user = data.user;
    const userId = user?._id?.toString() || user?.toString();
    const profile = profileMap[userId];

    return {
        id: data._id,
        walletNumber: data.walletNumber,
        currency: data.currency,
        availableBalance: data.availableBalance,
        holdBalance: data.holdBalance,
        totalBalance: data.totalBalance,
        status: data.status,
        isKycCompleted: data.isKycCompleted,
        dailyLimit: data.dailyLimit,
        monthlyLimit: data.monthlyLimit,
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
    walletNumber: "walletNumber",
    availableBalance: "availableBalance",
    holdBalance: "holdBalance",
    status: "status",
    createdAt: "createdAt",
    isKycCompleted: "isKycCompleted",
};

exports.getWallets = async (query) => {
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

        const userIds = users.map((u) => u._id);

        filter.$or = [
            { walletNumber: { $regex: search, $options: "i" } },
            { user: { $in: userIds } },
        ];
    }

    const sortField =
        SORTABLE_FIELDS[query.sortBy] || SORTABLE_FIELDS.createdAt;
    const sortDir = query.sortOrder === "asc" ? 1 : -1;

    const [wallets, total] = await Promise.all([
        Wallet.find(filter)
            .populate("user", "mobile email status")
            .sort({ [sortField]: sortDir })
            .skip(skip)
            .limit(limit),
        Wallet.countDocuments(filter),
    ]);

    const userIds = wallets
        .map((w) => w.user?._id?.toString())
        .filter(Boolean);

    const profiles = await UserProfile.find({ user: { $in: userIds } });
    const profileMap = Object.fromEntries(
        profiles.map((p) => [p.user.toString(), p])
    );

    return {
        wallets: wallets.map((w) => formatAdminWallet(w, profileMap)),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getWalletById = async (walletId) => {
    const wallet = await Wallet.findById(walletId).populate(
        "user",
        "mobile email status"
    );

    if (!wallet) {
        throw new ApiError(404, "Wallet not found");
    }

    const profile = await UserProfile.findOne({ user: wallet.user._id });

    const [transactions, transactionCount] = await Promise.all([
        WalletTransaction.find({ wallet: walletId })
            .sort({ createdAt: -1 })
            .limit(20),
        WalletTransaction.countDocuments({ wallet: walletId }),
    ]);

    return {
        ...formatAdminWallet(wallet, {
            [wallet.user._id.toString()]: profile,
        }),
        transactions: transactions.map(formatTransaction),
        transactionCount,
    };
};

exports.createWallet = async ({ mobile, userId, initialBalance = 0 }) => {
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
        throw new ApiError(400, "Cannot create wallet for admin account");
    }

    const existing = await Wallet.findOne({ user: user._id });

    if (existing) {
        throw new ApiError(400, "Wallet already exists for this user");
    }

    const balance = Math.max(0, Number(initialBalance) || 0);

    const wallet = await Wallet.create({
        user: user._id,
        walletNumber: generateWalletNumber(),
        availableBalance: balance,
        totalBalance: balance,
    });

    if (balance > 0) {
        await WalletTransaction.create({
            wallet: wallet._id,
            user: user._id,
            transactionId: generateTransactionId(),
            transactionType: "CREDIT",
            paymentMethod: "WALLET",
            amount: balance,
            openingBalance: 0,
            closingBalance: balance,
            description: "Initial wallet balance by admin",
            status: "SUCCESS",
        });
    }

    return exports.getWalletById(wallet._id);
};

exports.updateWallet = async (walletId, body) => {
    const wallet = await Wallet.findById(walletId);

    if (!wallet) {
        throw new ApiError(404, "Wallet not found");
    }

    if (body.status !== undefined) {
        wallet.status = body.status;
    }

    if (body.isKycCompleted !== undefined) {
        wallet.isKycCompleted = Boolean(body.isKycCompleted);
    }

    if (body.dailyLimit !== undefined) {
        wallet.dailyLimit = Number(body.dailyLimit);
    }

    if (body.monthlyLimit !== undefined) {
        wallet.monthlyLimit = Number(body.monthlyLimit);
    }

    if (body.currency !== undefined) {
        wallet.currency = body.currency.trim().toUpperCase();
    }

    if (body.holdBalance !== undefined) {
        const holdBalance = Math.max(0, Number(body.holdBalance));

        if (holdBalance > wallet.availableBalance) {
            throw new ApiError(400, "Hold balance cannot exceed available balance");
        }

        wallet.holdBalance = holdBalance;
        wallet.totalBalance = wallet.availableBalance;
    }

    await wallet.save();

    return exports.getWalletById(walletId);
};

exports.adjustBalance = async (walletId, { type, amount, description }) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const wallet = await Wallet.findById(walletId).session(session);

        if (!wallet) {
            throw new ApiError(404, "Wallet not found");
        }

        if (wallet.status !== "ACTIVE") {
            throw new ApiError(400, "Wallet is not active");
        }

        const value = Number(amount);

        if (!value || value <= 0) {
            throw new ApiError(400, "Amount must be greater than 0");
        }

        const openingBalance = wallet.availableBalance;
        let closingBalance = openingBalance;
        let transactionType;

        if (type === "CREDIT") {
            closingBalance = openingBalance + value;
            transactionType = "CREDIT";
        } else if (type === "DEBIT") {
            if (openingBalance < value) {
                throw new ApiError(400, "Insufficient wallet balance");
            }
            closingBalance = openingBalance - value;
            transactionType = "DEBIT";
        } else {
            throw new ApiError(400, "Type must be CREDIT or DEBIT");
        }

        wallet.availableBalance = closingBalance;
        wallet.totalBalance = closingBalance;

        if (wallet.holdBalance > closingBalance) {
            wallet.holdBalance = closingBalance;
        }

        await wallet.save({ session });

        await WalletTransaction.create(
            [
                {
                    wallet: wallet._id,
                    user: wallet.user,
                    transactionId: generateTransactionId(),
                    transactionType,
                    paymentMethod: "WALLET",
                    amount: value,
                    openingBalance,
                    closingBalance,
                    description: description || `Admin ${type.toLowerCase()}`,
                    status: "SUCCESS",
                },
            ],
            { session }
        );

        await session.commitTransaction();

        return exports.getWalletById(walletId);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

exports.deleteWallet = async (walletId) => {
    const wallet = await Wallet.findById(walletId);

    if (!wallet) {
        throw new ApiError(404, "Wallet not found");
    }

    wallet.status = "BLOCKED";
    await wallet.save();

    return {
        id: wallet._id,
        walletNumber: wallet.walletNumber,
        status: wallet.status,
    };
};
