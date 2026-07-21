const mongoose = require("mongoose");

const coinWalletRepository = require("./repository");
const coinTransactionRepository = require("./transaction.repository");
const notificationService = require("../notification/service");
const ApiError = require("../../utils/ApiError");
const {
    formatCoinWallet,
    formatCoinTransaction,
} = require("./mapper");

const generateCoinAccountNumber = () =>
    "COIN" + Date.now() + Math.floor(Math.random() * 1000);

const generateTransactionId = () =>
    "CTXN" + Date.now() + Math.floor(Math.random() * 1000);

exports.getOrCreateWallet = async (userId, session = null) => {
    let wallet = await coinWalletRepository.findByUserId(userId);

    if (wallet) return wallet;

    const payload = {
        user: userId,
        coinAccountNumber: generateCoinAccountNumber(),
    };

    if (session) {
        const docs = await coinWalletRepository.model.create([payload], {
            session,
        });
        return docs[0];
    }

    return coinWalletRepository.create(payload);
};

exports.getMyCoins = async (userId) => {
    const wallet = await exports.getOrCreateWallet(userId);
    return formatCoinWallet(wallet);
};

exports.getTransactions = async (userId, query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const [transactions, total] = await Promise.all([
        coinTransactionRepository.findByUserId(userId, { page, limit }),
        coinTransactionRepository.countByUserId(userId),
    ]);

    return {
        transactions: transactions.map(formatCoinTransaction),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.creditCoins = async (
    userId,
    {
        amount,
        description = "Coins credited",
        referenceId = null,
        source = "OTHER",
        notify = true,
    },
    session = null
) => {
    const value = Number(amount);

    if (!value || value <= 0) {
        throw new ApiError(400, "Coin amount must be greater than 0");
    }

    const ownSession = !session;

    if (ownSession) {
        session = await mongoose.startSession();
        session.startTransaction();
    }

    try {
        const wallet = await exports.getOrCreateWallet(userId, session);

        if (wallet.status !== "ACTIVE") {
            throw new ApiError(400, "Coin account is not active");
        }

        const openingBalance = wallet.availableBalance;
        const closingBalance = openingBalance + value;

        wallet.availableBalance = closingBalance;
        wallet.totalBalance = closingBalance;
        wallet.lifetimeEarned = (wallet.lifetimeEarned || 0) + value;
        await wallet.save({ session });

        const transaction = await coinTransactionRepository.create(
            {
                coinWallet: wallet._id,
                user: userId,
                transactionId: generateTransactionId(),
                referenceId,
                transactionType: "CREDIT",
                source,
                amount: value,
                openingBalance,
                closingBalance,
                description,
                status: "SUCCESS",
            },
            session
        );

        if (ownSession) {
            await session.commitTransaction();
        }

        if (notify && ownSession) {
            try {
                await notificationService.create(userId, {
                    title: "Coins received",
                    message: `You received ${value} coins`,
                    type: "SUCCESS",
                });
            } catch (err) {
                console.error("Coin credit notification failed:", err.message);
            }
        }

        return {
            wallet: formatCoinWallet(wallet),
            transaction: formatCoinTransaction(transaction),
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

exports.debitCoins = async (
    userId,
    {
        amount,
        description = "Coins debited",
        referenceId = null,
        source = "OTHER",
    },
    session = null
) => {
    const value = Number(amount);

    if (!value || value <= 0) {
        throw new ApiError(400, "Coin amount must be greater than 0");
    }

    const ownSession = !session;

    if (ownSession) {
        session = await mongoose.startSession();
        session.startTransaction();
    }

    try {
        const wallet = await coinWalletRepository.findByUserId(userId);

        if (!wallet) {
            throw new ApiError(404, "Coin account not found");
        }

        if (wallet.status !== "ACTIVE") {
            throw new ApiError(400, "Coin account is not active");
        }

        if (wallet.availableBalance < value) {
            throw new ApiError(400, "Insufficient coin balance");
        }

        const openingBalance = wallet.availableBalance;
        const closingBalance = openingBalance - value;

        wallet.availableBalance = closingBalance;
        wallet.totalBalance = closingBalance;
        wallet.lifetimeSpent = (wallet.lifetimeSpent || 0) + value;
        await wallet.save({ session });

        const transaction = await coinTransactionRepository.create(
            {
                coinWallet: wallet._id,
                user: userId,
                transactionId: generateTransactionId(),
                referenceId,
                transactionType: "DEBIT",
                source,
                amount: value,
                openingBalance,
                closingBalance,
                description,
                status: "SUCCESS",
            },
            session
        );

        if (ownSession) {
            await session.commitTransaction();
        }

        return {
            wallet: formatCoinWallet(wallet),
            transaction: formatCoinTransaction(transaction),
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
