const REASON_LABELS = {
    BONUS: "Bonus",
    OFFER: "Offer",
    WELCOME_GIFT: "Welcome Gift",
    PROMOTION: "Promotion",
    ADJUSTMENT: "Adjustment",
    OTHER: "Other",
};

exports.formatCoinTransfer = (transfer, profileMap = {}) => {
    if (!transfer) return null;

    const data = transfer.toObject ? transfer.toObject() : transfer;
    const user = data.user;
    const admin = data.transferredBy;
    const userId = user?._id?.toString() || user?.toString();
    const profile = profileMap[userId];

    return {
        id: data._id,
        transferId: data.transferId,
        amount: data.amount,
        reason: data.reason,
        reasonLabel: REASON_LABELS[data.reason] || data.reason,
        note: data.note || "",
        status: data.status,
        transferredAt: data.transferredAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        user: user
            ? {
                  id: user._id || user,
                  mobile: user.mobile || "",
                  email: user.email || "",
                  fullName: profile
                      ? [profile.firstName, profile.lastName]
                            .filter(Boolean)
                            .join(" ")
                      : "",
              }
            : { id: data.user },
        coinWalletId: data.coinWallet?._id || data.coinWallet,
        transferredBy: admin
            ? {
                  id: admin._id || admin,
                  email: admin.email || "",
                  mobile: admin.mobile || "",
              }
            : null,
    };
};

exports.REASON_LABELS = REASON_LABELS;
