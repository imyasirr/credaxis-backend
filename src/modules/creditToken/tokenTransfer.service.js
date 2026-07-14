const mongoose = require("mongoose");
const Partner = require("../partner/partner.model");
const TokenTransfer = require("./tokenTransfer.model");
const PartnerTokenBalance = require("./partnerTokenBalance.model");
const {
    formatTokenTransfer,
    formatPartnerTokenBalance,
} = require("./tokenTransfer.mapper");
const ApiError = require("../../utils/ApiError");

const generateTransferId = () =>
    `TT${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

const getOrCreateBalance = async (partnerId, partnerUserId, tokenType, session) => {
    let balance = await PartnerTokenBalance.findOne({
        partner: partnerId,
        tokenType,
    }).session(session);

    if (!balance) {
        const created = await PartnerTokenBalance.create(
            [
                {
                    partner: partnerId,
                    partnerUser: partnerUserId,
                    tokenType,
                    availableQuantity: 0,
                    totalReceived: 0,
                },
            ],
            { session }
        );
        balance = created[0];
    }

    return balance;
};

/** Credit partner token inventory (used by admin transfer + partner self-purchase). */
exports.creditPartnerBalance = async (
    partnerId,
    partnerUserId,
    tokenType,
    quantity,
    session
) => {
    const balance = await getOrCreateBalance(
        partnerId,
        partnerUserId,
        tokenType,
        session
    );

    balance.availableQuantity += quantity;
    balance.totalReceived += quantity;
    await balance.save({ session });

    return balance;
};

exports.createTransfer = async (adminId, body) => {
    const partner = await Partner.findById(body.partnerId);

    if (!partner) {
        throw new ApiError(404, "Partner not found");
    }

    if (partner.status !== "APPROVED") {
        throw new ApiError(400, "Tokens can only be transferred to approved partners");
    }

    const quantity = Number(body.quantity);

    if (!quantity || quantity < 1) {
        throw new ApiError(400, "Quantity must be at least 1");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await exports.creditPartnerBalance(
            partner._id,
            partner.user,
            body.tokenType,
            quantity,
            session
        );

        const [transfer] = await TokenTransfer.create(
            [
                {
                    partner: partner._id,
                    partnerUser: partner.user,
                    transferredBy: adminId,
                    tokenType: body.tokenType,
                    quantity,
                    reason: body.reason,
                    note: body.note?.trim() || "",
                    transferId: generateTransferId(),
                    status: "SUCCESS",
                    transferredAt: new Date(),
                },
            ],
            { session }
        );

        await session.commitTransaction();

        const populated = await TokenTransfer.findById(transfer._id)
            .populate("partner", "businessName ownerName partnerCode email")
            .populate("transferredBy", "email mobile");

        return formatTokenTransfer(populated);
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

    if (query.partnerId) filter.partner = query.partnerId;
    if (query.partnerUserId) filter.partnerUser = query.partnerUserId;
    if (query.tokenType) filter.tokenType = query.tokenType;
    if (query.reason) filter.reason = query.reason;
    if (query.status) filter.status = query.status;

    if (query.search) {
        const search = query.search.trim();
        const partners = await Partner.find({
            $or: [
                { businessName: { $regex: search, $options: "i" } },
                { ownerName: { $regex: search, $options: "i" } },
                { partnerCode: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ],
        }).select("_id");

        filter.$or = [
            { transferId: { $regex: search, $options: "i" } },
            { note: { $regex: search, $options: "i" } },
            { partner: { $in: partners.map((p) => p._id) } },
        ];
    }

    const [transfers, total] = await Promise.all([
        TokenTransfer.find(filter)
            .populate("partner", "businessName ownerName partnerCode email")
            .populate("transferredBy", "email mobile")
            .sort({ transferredAt: -1 })
            .skip(skip)
            .limit(limit),
        TokenTransfer.countDocuments(filter),
    ]);

    return {
        transfers: transfers.map(formatTokenTransfer),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getTransferById = async (transferId) => {
    const transfer = await TokenTransfer.findById(transferId)
        .populate("partner", "businessName ownerName partnerCode email")
        .populate("transferredBy", "email mobile");

    if (!transfer) {
        throw new ApiError(404, "Token transfer not found");
    }

    return formatTokenTransfer(transfer);
};

exports.getPartnerBalances = async (partnerId) => {
    const balances = await PartnerTokenBalance.find({ partner: partnerId });
    return formatPartnerTokenBalance(balances);
};

exports.getPartnerBalancesByUser = async (partnerUserId) => {
    const balances = await PartnerTokenBalance.find({
        partnerUser: partnerUserId,
    });
    return formatPartnerTokenBalance(balances);
};
