const mongoose = require("mongoose");
const User = require("../user/model");
const UserProfile = require("../user/profile.model");
const Role = require("../role/model");
const CoinTransfer = require("./transfer.model");
const coinService = require("./service");
const ROLES = require("../../constants/roles");
const ApiError = require("../../utils/ApiError");
const {
    formatCoinTransfer,
    REASON_LABELS,
} = require("./transfer.mapper");

const generateTransferId = () =>
    `CT${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

const resolveTransferUser = async ({ mobile, userId }) => {
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

    if (adminRole && user.role.toString() === adminRole._id.toString()) {
        throw new ApiError(400, "Coins cannot be transferred to admin");
    }

    return user;
};

exports.createTransfer = async (adminId, body) => {
    const user = await resolveTransferUser(body);
    const amount = Number(body.amount);

    if (!amount || amount < 1) {
        throw new ApiError(400, "Amount must be at least 1");
    }

    const transferId = generateTransferId();
    const reasonLabel = REASON_LABELS[body.reason] || body.reason;
    const note = body.note?.trim() || "";
    const description = note || `Coins transferred by admin (${reasonLabel})`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { wallet } = await coinService.creditCoins(
            user._id,
            {
                amount,
                source: "TRANSFER",
                description,
                referenceId: transferId,
                notify: true,
            },
            session
        );

        const [transfer] = await CoinTransfer.create(
            [
                {
                    user: user._id,
                    coinWallet: wallet.id,
                    transferredBy: adminId,
                    amount,
                    reason: body.reason,
                    note,
                    transferId,
                    status: "SUCCESS",
                    transferredAt: new Date(),
                },
            ],
            { session }
        );

        await session.commitTransaction();

        const populated = await CoinTransfer.findById(transfer._id)
            .populate("user", "mobile email status")
            .populate("transferredBy", "email mobile");

        const profile = await UserProfile.findOne({ user: user._id });

        return formatCoinTransfer(populated, {
            [user._id.toString()]: profile,
        });
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

exports.getTransfers = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.userId) filter.user = query.userId;
    if (query.reason) filter.reason = query.reason;
    if (query.status) filter.status = query.status;

    if (query.search) {
        const search = query.search.trim();
        const users = await User.find({
            mobile: { $regex: search, $options: "i" },
            isDeleted: false,
        }).select("_id");

        filter.$or = [
            { transferId: { $regex: search, $options: "i" } },
            { note: { $regex: search, $options: "i" } },
            { user: { $in: users.map((u) => u._id) } },
        ];
    }

    const [transfers, total] = await Promise.all([
        CoinTransfer.find(filter)
            .populate("user", "mobile email status")
            .populate("transferredBy", "email mobile")
            .sort({ transferredAt: -1 })
            .skip(skip)
            .limit(limit),
        CoinTransfer.countDocuments(filter),
    ]);

    const userIds = transfers
        .map((item) => item.user?._id?.toString())
        .filter(Boolean);

    const profiles = await UserProfile.find({ user: { $in: userIds } });
    const profileMap = Object.fromEntries(
        profiles.map((profile) => [profile.user.toString(), profile])
    );

    return {
        transfers: transfers.map((item) =>
            formatCoinTransfer(item, profileMap)
        ),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getTransferById = async (transferId) => {
    const transfer = await CoinTransfer.findById(transferId)
        .populate("user", "mobile email status")
        .populate("transferredBy", "email mobile");

    if (!transfer) {
        throw new ApiError(404, "Coin transfer not found");
    }

    const profile = await UserProfile.findOne({ user: transfer.user._id });

    return formatCoinTransfer(transfer, {
        [transfer.user._id.toString()]: profile,
    });
};
