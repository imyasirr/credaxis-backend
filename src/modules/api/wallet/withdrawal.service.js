const mongoose = require("mongoose");

const WithdrawalRequest = require("./withdrawalRequest.model");
const {
    WITHDRAWAL_STATUSES,
    DESTINATION_TYPES,
} = require("./withdrawalRequest.model");
const walletRepository = require("./repository");
const transactionRepository = require("./transaction.repository");
const BankAccount = require("./bankAccount.model");
const Beneficiary = require("./beneficiary.model");
const payoutClient = require("../../../integrations/payout/payout.client");
const notificationService = require("../notification/service");
const ApiError = require("../../../utils/ApiError");
const {
    formatWallet,
    formatWithdrawal,
    formatBankAccount,
    formatBeneficiary,
} = require("./mapper");

const MIN_WITHDRAW_AMOUNT = 10;
const DEFAULT_EXPECTED_HOURS = 48;

const generateTransactionId = () =>
    "TXN" + Date.now() + Math.floor(Math.random() * 1000);

const addExpectedAt = (from = new Date(), hours = DEFAULT_EXPECTED_HOURS) =>
    new Date(from.getTime() + hours * 60 * 60 * 1000);

const maskAccount = (accountNumber = "") => {
    const value = String(accountNumber || "");
    if (value.length <= 4) return value;
    return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const resolveDestination = async (userId, destinationType, destinationId) => {
    const type = String(destinationType || "").toUpperCase();

    if (type === DESTINATION_TYPES.BANK_ACCOUNT) {
        const bank = await BankAccount.findOne({
            _id: destinationId,
            user: userId,
            status: "ACTIVE",
        });
        if (!bank) {
            throw new ApiError(404, "Bank account not found");
        }
        return {
            destinationType: DESTINATION_TYPES.BANK_ACCOUNT,
            destinationId: bank._id,
            bankSnapshot: {
                accountHolderName: bank.accountHolderName,
                bankName: bank.bankName,
                accountNumber: bank.accountNumber,
                ifscCode: bank.ifscCode,
                accountType: bank.accountType || "SAVING",
                nickname: bank.isPrimary ? "Primary" : "",
            },
        };
    }

    if (type === DESTINATION_TYPES.BENEFICIARY) {
        const beneficiary = await Beneficiary.findOne({
            _id: destinationId,
            user: userId,
            status: "ACTIVE",
        });
        if (!beneficiary) {
            throw new ApiError(404, "Beneficiary not found");
        }
        return {
            destinationType: DESTINATION_TYPES.BENEFICIARY,
            destinationId: beneficiary._id,
            bankSnapshot: {
                accountHolderName: beneficiary.beneficiaryName,
                bankName: beneficiary.bankName,
                accountNumber: beneficiary.accountNumber,
                ifscCode: beneficiary.ifscCode,
                accountType: "",
                nickname: beneficiary.nickname || "",
            },
        };
    }

    throw new ApiError(
        400,
        `destinationType must be one of: ${Object.values(DESTINATION_TYPES).join(", ")}`
    );
};

/** Move available → hold (does not create SUCCESS debit yet). */
const holdFunds = async (wallet, amount, session) => {
    if (wallet.availableBalance < amount) {
        throw new ApiError(400, "Insufficient wallet balance");
    }
    wallet.availableBalance = Number(wallet.availableBalance) - amount;
    wallet.holdBalance = Number(wallet.holdBalance || 0) + amount;
    wallet.totalBalance =
        Number(wallet.availableBalance) + Number(wallet.holdBalance);
    await wallet.save({ session });
};

const releaseHold = async (wallet, amount, session) => {
    const hold = Number(wallet.holdBalance || 0);
    if (hold < amount) {
        throw new ApiError(400, "Hold balance mismatch for this withdrawal");
    }
    wallet.holdBalance = hold - amount;
    wallet.availableBalance = Number(wallet.availableBalance) + amount;
    wallet.totalBalance =
        Number(wallet.availableBalance) + Number(wallet.holdBalance);
    await wallet.save({ session });
};

const settleHold = async (wallet, amount, session) => {
    const hold = Number(wallet.holdBalance || 0);
    if (hold < amount) {
        throw new ApiError(400, "Hold balance mismatch for this withdrawal");
    }
    wallet.holdBalance = hold - amount;
    wallet.totalBalance =
        Number(wallet.availableBalance) + Number(wallet.holdBalance);
    await wallet.save({ session });
};

exports.getWithdrawDestinations = async (userId) => {
    const [banks, beneficiaries] = await Promise.all([
        BankAccount.find({ user: userId, status: "ACTIVE" }).sort({
            isPrimary: -1,
            createdAt: -1,
        }),
        Beneficiary.find({ user: userId, status: "ACTIVE" }).sort({
            createdAt: -1,
        }),
    ]);

    return {
        bankAccounts: banks.map(formatBankAccount),
        beneficiaries: beneficiaries.map(formatBeneficiary),
        minAmount: MIN_WITHDRAW_AMOUNT,
        expectedHours: DEFAULT_EXPECTED_HOURS,
    };
};

exports.createWithdrawal = async (userId, body = {}) => {
    const amount = Number(body.amount);
    if (!amount || amount < MIN_WITHDRAW_AMOUNT) {
        throw new ApiError(
            400,
            `Minimum withdraw amount is ₹${MIN_WITHDRAW_AMOUNT}`
        );
    }

    const wallet = await walletRepository.findByUserId(userId);
    if (!wallet) {
        throw new ApiError(404, "Wallet not found");
    }
    if (wallet.status !== "ACTIVE") {
        throw new ApiError(400, "Wallet is not active");
    }

    const destination = await resolveDestination(
        userId,
        body.destinationType,
        body.destinationId
    );

    const openCount = await WithdrawalRequest.countDocuments({
        user: userId,
        status: {
            $in: [
                WITHDRAWAL_STATUSES.PENDING,
                WITHDRAWAL_STATUSES.PROCESSING,
            ],
        },
    });
    if (openCount >= 3) {
        throw new ApiError(
            400,
            "You already have open withdrawal requests. Wait for them to finish"
        );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const Wallet = require("./model");
        const locked = await Wallet.findById(wallet._id).session(session);
        if (!locked || locked.status !== "ACTIVE") {
            throw new ApiError(400, "Wallet is not active");
        }

        await holdFunds(locked, amount, session);

        const requestedAt = new Date();
        const [doc] = await WithdrawalRequest.create(
            [
                {
                    user: userId,
                    wallet: locked._id,
                    amount,
                    currency: locked.currency || "INR",
                    status: WITHDRAWAL_STATUSES.PENDING,
                    destinationType: destination.destinationType,
                    destinationId: destination.destinationId,
                    bankSnapshot: destination.bankSnapshot,
                    requestedAt,
                    expectedAt: addExpectedAt(requestedAt),
                },
            ],
            { session }
        );

        await session.commitTransaction();

        await notificationService.notifySafe(userId, {
            title: "Withdrawal requested",
            message: `₹${amount} withdrawal is pending. Expected by ${doc.expectedAt?.toISOString?.() || "soon"}`,
            type: "INFO",
        });

        return {
            withdrawal: formatWithdrawal(doc),
            wallet: formatWallet(locked),
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

exports.listMyWithdrawals = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const filter = { user: userId };

    if (query.status) {
        filter.status = String(query.status).toUpperCase();
    }

    const [items, total] = await Promise.all([
        WithdrawalRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        WithdrawalRequest.countDocuments(filter),
    ]);

    return {
        withdrawals: items.map(formatWithdrawal),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
};

exports.getMyWithdrawalById = async (userId, id) => {
    const doc = await WithdrawalRequest.findOne({ _id: id, user: userId });
    if (!doc) {
        throw new ApiError(404, "Withdrawal not found");
    }
    return formatWithdrawal(doc);
};

exports.cancelMyWithdrawal = async (userId, id) => {
    const doc = await WithdrawalRequest.findOne({ _id: id, user: userId });
    if (!doc) {
        throw new ApiError(404, "Withdrawal not found");
    }
    if (doc.status !== WITHDRAWAL_STATUSES.PENDING) {
        throw new ApiError(400, "Only PENDING withdrawals can be cancelled");
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const Wallet = require("./model");
        const wallet = await Wallet.findById(doc.wallet).session(session);
        if (!wallet) {
            throw new ApiError(404, "Wallet not found");
        }

        await releaseHold(wallet, doc.amount, session);

        doc.status = WITHDRAWAL_STATUSES.CANCELLED;
        doc.processedAt = new Date();
        doc.failureReason = "Cancelled by user";
        await doc.save({ session });

        await session.commitTransaction();

        await notificationService.notifySafe(userId, {
            title: "Withdrawal cancelled",
            message: `₹${doc.amount} has been returned to your wallet`,
            type: "INFO",
        });

        return {
            withdrawal: formatWithdrawal(doc),
            wallet: formatWallet(wallet),
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

/** ---------- Admin ---------- */

exports.adminListWithdrawals = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.status) filter.status = String(query.status).toUpperCase();
    if (query.userId) filter.user = query.userId;

    if (query.search) {
        const s = String(query.search).trim();
        filter.$or = [
            { "bankSnapshot.accountNumber": { $regex: s, $options: "i" } },
            { "bankSnapshot.accountHolderName": { $regex: s, $options: "i" } },
            { "bankSnapshot.ifscCode": { $regex: s, $options: "i" } },
            { providerPayoutId: { $regex: s, $options: "i" } },
        ];
    }

    const [items, total] = await Promise.all([
        WithdrawalRequest.find(filter)
            .populate("user", "mobile email status")
            .populate("processedBy", "mobile email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        WithdrawalRequest.countDocuments(filter),
    ]);

    return {
        withdrawals: items.map(formatWithdrawal),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
};

exports.adminGetWithdrawalById = async (id) => {
    const doc = await WithdrawalRequest.findById(id)
        .populate("user", "mobile email status")
        .populate("processedBy", "mobile email");
    if (!doc) {
        throw new ApiError(404, "Withdrawal not found");
    }
    return formatWithdrawal(doc);
};

/**
 * Call payout provider stub / future API and mark PROCESSING.
 */
exports.adminInitiatePayout = async (id, adminId, body = {}) => {
    const doc = await WithdrawalRequest.findById(id);
    if (!doc) {
        throw new ApiError(404, "Withdrawal not found");
    }
    if (
        doc.status !== WITHDRAWAL_STATUSES.PENDING &&
        doc.status !== WITHDRAWAL_STATUSES.PROCESSING
    ) {
        throw new ApiError(
            400,
            "Payout can only be initiated for PENDING or PROCESSING withdrawals"
        );
    }

    const result = await payoutClient.initiatePayout({
        amount: doc.amount,
        currency: doc.currency,
        accountHolderName: doc.bankSnapshot.accountHolderName,
        accountNumber: doc.bankSnapshot.accountNumber,
        ifscCode: doc.bankSnapshot.ifscCode,
        bankName: doc.bankSnapshot.bankName,
        referenceId: String(doc._id),
    });

    doc.status = WITHDRAWAL_STATUSES.PROCESSING;
    doc.provider = result.provider || "MANUAL";
    doc.providerPayoutId = result.providerPayoutId || doc.providerPayoutId;
    doc.providerStatus = result.providerStatus || "QUEUED";
    doc.providerMeta = {
        ...(doc.providerMeta || {}),
        ...(result.meta || {}),
        lastInitiateMessage: result.message || "",
    };
    if (body.expectedAt) {
        doc.expectedAt = new Date(body.expectedAt);
    }
    if (body.adminRemark !== undefined) {
        doc.adminRemark = String(body.adminRemark || "").trim();
    }
    doc.processedBy = adminId;
    await doc.save();

    await notificationService.notifySafe(doc.user, {
        title: "Withdrawal processing",
        message: `₹${doc.amount} withdrawal is being processed`,
        type: "INFO",
    });

    return formatWithdrawal(doc);
};

exports.adminMarkSuccess = async (id, adminId, body = {}) => {
    const doc = await WithdrawalRequest.findById(id);
    if (!doc) {
        throw new ApiError(404, "Withdrawal not found");
    }
    if (
        ![
            WITHDRAWAL_STATUSES.PENDING,
            WITHDRAWAL_STATUSES.PROCESSING,
        ].includes(doc.status)
    ) {
        throw new ApiError(400, "Withdrawal cannot be marked SUCCESS in this status");
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const Wallet = require("./model");
        const wallet = await Wallet.findById(doc.wallet).session(session);
        if (!wallet) {
            throw new ApiError(404, "Wallet not found");
        }

        const openingBalance = wallet.availableBalance;
        await settleHold(wallet, doc.amount, session);

        const transaction = await transactionRepository.create(
            {
                wallet: wallet._id,
                user: doc.user,
                transactionId: generateTransactionId(),
                referenceId: String(doc._id),
                transactionType: "DEBIT",
                paymentMethod: "BANK",
                amount: doc.amount,
                openingBalance,
                closingBalance: wallet.availableBalance,
                description:
                    body.description ||
                    `Withdrawal to ${maskAccount(doc.bankSnapshot.accountNumber)}`,
                status: "SUCCESS",
            },
            session
        );

        doc.status = WITHDRAWAL_STATUSES.SUCCESS;
        doc.processedAt = new Date();
        doc.processedBy = adminId;
        doc.walletTransaction = transaction._id;
        doc.providerStatus = body.providerStatus || doc.providerStatus || "PAID";
        if (body.providerPayoutId) {
            doc.providerPayoutId = body.providerPayoutId;
        }
        if (body.adminRemark !== undefined) {
            doc.adminRemark = String(body.adminRemark || "").trim();
        }
        await doc.save({ session });

        await session.commitTransaction();

        await notificationService.notifySafe(doc.user, {
            title: "Withdrawal successful",
            message: `₹${doc.amount} has been sent to your bank account`,
            type: "SUCCESS",
        });

        return formatWithdrawal(doc);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const finalizeFailedOrRejected = async (
    id,
    adminId,
    { status, reason, adminRemark }
) => {
    const doc = await WithdrawalRequest.findById(id);
    if (!doc) {
        throw new ApiError(404, "Withdrawal not found");
    }
    if (
        ![
            WITHDRAWAL_STATUSES.PENDING,
            WITHDRAWAL_STATUSES.PROCESSING,
        ].includes(doc.status)
    ) {
        throw new ApiError(400, `Withdrawal cannot be ${status} in this status`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const Wallet = require("./model");
        const wallet = await Wallet.findById(doc.wallet).session(session);
        if (!wallet) {
            throw new ApiError(404, "Wallet not found");
        }

        await releaseHold(wallet, doc.amount, session);

        doc.status = status;
        doc.processedAt = new Date();
        doc.processedBy = adminId;
        doc.failureReason = reason || "";
        if (adminRemark !== undefined) {
            doc.adminRemark = String(adminRemark || "").trim();
        }
        await doc.save({ session });

        await session.commitTransaction();

        await notificationService.notifySafe(doc.user, {
            title:
                status === WITHDRAWAL_STATUSES.REJECTED
                    ? "Withdrawal rejected"
                    : "Withdrawal failed",
            message: `₹${doc.amount} returned to wallet${reason ? `: ${reason}` : ""}`,
            type: "WARNING",
        });

        return {
            withdrawal: formatWithdrawal(doc),
            wallet: formatWallet(wallet),
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

exports.adminReject = async (id, adminId, body = {}) =>
    finalizeFailedOrRejected(id, adminId, {
        status: WITHDRAWAL_STATUSES.REJECTED,
        reason: body.reason || "Rejected by admin",
        adminRemark: body.adminRemark,
    });

exports.adminMarkFailed = async (id, adminId, body = {}) =>
    finalizeFailedOrRejected(id, adminId, {
        status: WITHDRAWAL_STATUSES.FAILED,
        reason: body.reason || "Payout failed",
        adminRemark: body.adminRemark,
    });

exports.adminUpdateExpectedAt = async (id, adminId, body = {}) => {
    const doc = await WithdrawalRequest.findById(id);
    if (!doc) {
        throw new ApiError(404, "Withdrawal not found");
    }
    if (
        ![
            WITHDRAWAL_STATUSES.PENDING,
            WITHDRAWAL_STATUSES.PROCESSING,
        ].includes(doc.status)
    ) {
        throw new ApiError(400, "Cannot update expected date for closed withdrawal");
    }
    if (!body.expectedAt) {
        throw new ApiError(400, "expectedAt is required");
    }
    doc.expectedAt = new Date(body.expectedAt);
    if (body.adminRemark !== undefined) {
        doc.adminRemark = String(body.adminRemark || "").trim();
    }
    doc.processedBy = adminId;
    await doc.save();
    return formatWithdrawal(doc);
};

exports.WITHDRAWAL_STATUSES = WITHDRAWAL_STATUSES;
exports.DESTINATION_TYPES = DESTINATION_TYPES;
exports.MIN_WITHDRAW_AMOUNT = MIN_WITHDRAW_AMOUNT;
