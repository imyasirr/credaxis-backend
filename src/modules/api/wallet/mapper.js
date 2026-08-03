exports.formatWallet = (wallet) => {
    if (!wallet) {
        return null;
    }

    const data = wallet.toObject ? wallet.toObject() : wallet;

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
    };
};

exports.formatTransaction = (transaction) => {
    const data = transaction.toObject ? transaction.toObject() : transaction;

    return {
        id: data._id,
        transactionId: data.transactionId,
        transactionType: data.transactionType,
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        charges: data.charges,
        gst: data.gst,
        openingBalance: data.openingBalance,
        closingBalance: data.closingBalance,
        description: data.description,
        status: data.status,
        createdAt: data.createdAt,
    };
};

exports.formatBeneficiary = (beneficiary) => {
    const data = beneficiary.toObject ? beneficiary.toObject() : beneficiary;

    return {
        id: data._id,
        beneficiaryName: data.beneficiaryName,
        mobile: data.mobile || "",
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        nickname: data.nickname,
        status: data.status,
        createdAt: data.createdAt,
    };
};
