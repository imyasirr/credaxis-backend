const mongoose = require("mongoose");

const walletRepository = require("./repository");
const transactionRepository = require("./transaction.repository");
const beneficiaryRepository = require("./beneficiary.repository");
const notificationService = require("../notification/service");

const ApiError = require("../../utils/ApiError");
const {
    formatWallet,
    formatTransaction,
    formatBeneficiary,
} = require("./mapper");

const generateTransactionId = () => {
    return "TXN" + Date.now() + Math.floor(Math.random() * 1000);
};

exports.getMyWallet = async (userId) => {
    const wallet = await walletRepository.findByUserId(userId);

    if (!wallet) {
        throw new ApiError(404, "Wallet not found");
    }

    return formatWallet(wallet);
};

exports.getTransactions = async (userId, query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const [transactions, total] = await Promise.all([
        transactionRepository.findByUserId(userId, { page, limit }),
        transactionRepository.countByUserId(userId),
    ]);

    return {
        transactions: transactions.map(formatTransaction),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.addMoney = async (userId, { amount, description }) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const wallet = await walletRepository.findByUserId(userId);

        if (!wallet) {
            throw new ApiError(404, "Wallet not found");
        }

        if (wallet.status !== "ACTIVE") {
            throw new ApiError(400, "Wallet is not active");
        }

        const openingBalance = wallet.availableBalance;
        const closingBalance = openingBalance + amount;

        wallet.availableBalance = closingBalance;
        wallet.totalBalance = closingBalance;
        await wallet.save({ session });

        const transaction = await transactionRepository.create(
            {
                wallet: wallet._id,
                user: userId,
                transactionId: generateTransactionId(),
                transactionType: "CREDIT",
                paymentMethod: "WALLET",
                amount,
                openingBalance,
                closingBalance,
                description: description || "Wallet top-up",
                status: "SUCCESS",
            },
            session
        );

        await session.commitTransaction();

        await notificationService.notifySafe(userId, {
            title: "Money Added",
            message: `₹${amount} added to your wallet successfully`,
            type: "SUCCESS",
        });

        return {
            wallet: formatWallet(wallet),
            transaction: formatTransaction(transaction),
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * Debit wallet balance.
 * Pass an existing mongoose `session` to join a larger transaction
 * (e.g. token purchase). When session is provided, caller owns commit/abort.
 */
exports.debitMoney = async (
    userId,
    { amount, description, referenceId = null, notify = null },
    session = null
) => {
    const ownSession = !session;
    const shouldNotify = notify === null ? ownSession : Boolean(notify);

    if (ownSession) {
        session = await mongoose.startSession();
        session.startTransaction();
    }

    try {
        const Wallet = require("./model");
        const wallet = await Wallet.findOne({ user: userId }).session(session);

        if (!wallet) {
            throw new ApiError(404, "Wallet not found");
        }

        if (wallet.status !== "ACTIVE") {
            throw new ApiError(400, "Wallet is not active");
        }

        const debitAmount = Number(amount);

        if (!debitAmount || debitAmount <= 0) {
            throw new ApiError(400, "Amount must be greater than 0");
        }

        if (wallet.availableBalance < debitAmount) {
            throw new ApiError(400, "Insufficient wallet balance");
        }

        const openingBalance = wallet.availableBalance;
        const closingBalance = openingBalance - debitAmount;

        wallet.availableBalance = closingBalance;
        wallet.totalBalance = closingBalance;
        await wallet.save({ session });

        const transaction = await transactionRepository.create(
            {
                wallet: wallet._id,
                user: userId,
                transactionId: generateTransactionId(),
                referenceId,
                transactionType: "DEBIT",
                paymentMethod: "WALLET",
                amount: debitAmount,
                openingBalance,
                closingBalance,
                description: description || "Wallet debit",
                status: "SUCCESS",
            },
            session
        );

        if (ownSession) {
            await session.commitTransaction();
        }

        if (shouldNotify) {
            await notificationService.notifySafe(userId, {
                title: "Wallet debit",
                message: `₹${debitAmount} was deducted from your wallet`,
                type: "WARNING",
            });
        }

        return {
            wallet: formatWallet(wallet),
            transaction: formatTransaction(transaction),
            transactionDoc: transaction,
        };
    } catch (error) {
        if (ownSession) {
            await session.abortTransaction();
        }
        throw error;
    } finally {
        if (ownSession) {
            session.endSession();
        }
    }
};

exports.getBeneficiaries = async (userId) => {
    const beneficiaries = await beneficiaryRepository.findByUserId(userId);
    return beneficiaries.map(formatBeneficiary);
};

exports.addBeneficiary = async (userId, data) => {
    const beneficiary = await beneficiaryRepository.create({
        user: userId,
        beneficiaryName: data.beneficiaryName.trim(),
        mobile: data.mobile?.trim(),
        bankName: data.bankName.trim(),
        accountNumber: data.accountNumber.trim(),
        ifscCode: data.ifscCode.trim().toUpperCase(),
        nickname: data.nickname?.trim() || "",
    });

    return formatBeneficiary(beneficiary);
};

exports.updateBeneficiary = async (userId, id, data) => {
    const beneficiary = await beneficiaryRepository.findByIdAndUserId(
        id,
        userId
    );

    if (!beneficiary) {
        throw new ApiError(404, "Beneficiary not found");
    }

    if (data.beneficiaryName !== undefined) {
        beneficiary.beneficiaryName = data.beneficiaryName.trim();
    }
    if (data.mobile !== undefined) beneficiary.mobile = data.mobile.trim();
    if (data.bankName !== undefined) beneficiary.bankName = data.bankName.trim();
    if (data.accountNumber !== undefined) {
        beneficiary.accountNumber = data.accountNumber.trim();
    }
    if (data.ifscCode !== undefined) {
        beneficiary.ifscCode = data.ifscCode.trim().toUpperCase();
    }
    if (data.nickname !== undefined) beneficiary.nickname = data.nickname.trim();

    await beneficiary.save();

    return formatBeneficiary(beneficiary);
};

exports.deleteBeneficiary = async (userId, id) => {
    const beneficiary = await beneficiaryRepository.findByIdAndUserId(
        id,
        userId
    );

    if (!beneficiary) {
        throw new ApiError(404, "Beneficiary not found");
    }

    beneficiary.status = "INACTIVE";
    await beneficiary.save();

    return formatBeneficiary(beneficiary);
};
