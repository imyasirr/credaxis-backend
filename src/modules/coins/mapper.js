exports.formatCoinWallet = (wallet) => {
    if (!wallet) return null;

    const data = wallet.toObject ? wallet.toObject() : wallet;

    return {
        id: data._id,
        coinAccountNumber: data.coinAccountNumber,
        availableBalance: data.availableBalance,
        totalBalance: data.totalBalance,
        lifetimeEarned: data.lifetimeEarned,
        lifetimeSpent: data.lifetimeSpent,
        status: data.status,
        createdAt: data.createdAt,
    };
};

exports.formatCoinTransaction = (transaction) => {
    const data = transaction.toObject ? transaction.toObject() : transaction;

    return {
        id: data._id,
        transactionId: data.transactionId,
        transactionType: data.transactionType,
        source: data.source,
        amount: data.amount,
        openingBalance: data.openingBalance,
        closingBalance: data.closingBalance,
        description: data.description,
        status: data.status,
        createdAt: data.createdAt,
    };
};
