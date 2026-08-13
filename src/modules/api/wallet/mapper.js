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

exports.formatBankAccount = (bank) => {
    if (!bank) return null;
    const data = bank.toObject ? bank.toObject() : bank;
    const accountNumber = data.accountNumber || "";
    return {
        id: data._id,
        accountHolderName: data.accountHolderName || "",
        bankName: data.bankName || "",
        accountNumber,
        accountNumberMasked:
            accountNumber.length > 4
                ? `${"*".repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`
                : accountNumber,
        ifscCode: data.ifscCode || "",
        branchName: data.branchName || "",
        accountType: data.accountType || "SAVING",
        isPrimary: Boolean(data.isPrimary),
        isVerified: Boolean(data.isVerified),
        status: data.status,
        createdAt: data.createdAt,
    };
};

const formatUserLite = (user) => {
    if (!user) return null;
    if (typeof user !== "object") return { id: user };
    const data = user.toObject ? user.toObject() : user;
    return {
        id: data._id,
        mobile: data.mobile || "",
        email: data.email || "",
        status: data.status || null,
    };
};

exports.formatWithdrawal = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;
    const snap = data.bankSnapshot || {};
    const accountNumber = snap.accountNumber || "";

    return {
        id: data._id,
        amount: data.amount,
        currency: data.currency || "INR",
        status: data.status,
        destinationType: data.destinationType,
        destinationId: data.destinationId,
        bank: {
            accountHolderName: snap.accountHolderName || "",
            bankName: snap.bankName || "",
            accountNumber,
            accountNumberMasked:
                accountNumber.length > 4
                    ? `${"*".repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`
                    : accountNumber,
            ifscCode: snap.ifscCode || "",
            accountType: snap.accountType || "",
            nickname: snap.nickname || "",
        },
        requestedAt: data.requestedAt || data.createdAt,
        expectedAt: data.expectedAt || null,
        processedAt: data.processedAt || null,
        failureReason: data.failureReason || "",
        adminRemark: data.adminRemark || "",
        provider: data.provider || "MANUAL",
        providerPayoutId: data.providerPayoutId || null,
        providerStatus: data.providerStatus || null,
        walletTransactionId: data.walletTransaction || null,
        user: formatUserLite(data.user),
        processedBy: formatUserLite(data.processedBy),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};
