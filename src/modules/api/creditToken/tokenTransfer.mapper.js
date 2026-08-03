const REASON_LABELS = {
    BONUS: "Bonus",
    OFFER: "Offer",
    WELCOME_GIFT: "Welcome Gift",
    PROMOTION: "Promotion",
    ADJUSTMENT: "Adjustment",
    OTHER: "Other",
};

exports.formatTokenTransfer = (transfer) => {
    if (!transfer) return null;

    const data = transfer.toObject ? transfer.toObject() : transfer;
    const partner = data.partner;
    const admin = data.transferredBy;

    return {
        id: data._id,
        transferId: data.transferId,
        partner: partner
            ? {
                  id: partner._id || partner,
                  businessName: partner.businessName || "",
                  ownerName: partner.ownerName || "",
                  partnerCode: partner.partnerCode || "",
                  email: partner.email || "",
              }
            : { id: data.partner },
        partnerUserId: data.partnerUser?._id || data.partnerUser,
        tokenType: data.tokenType,
        quantity: data.quantity,
        reason: data.reason,
        reasonLabel: REASON_LABELS[data.reason] || data.reason,
        note: data.note || "",
        status: data.status,
        transferredBy: admin
            ? {
                  id: admin._id || admin,
                  email: admin.email || "",
                  mobile: admin.mobile || "",
              }
            : null,
        transferredAt: data.transferredAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatPartnerTokenBalance = (balances = []) => {
    const types = ["CRIF", "CIBIL", "EXPERIAN"];
    const map = Object.fromEntries(
        balances.map((item) => {
            const data = item.toObject ? item.toObject() : item;
            return [
                data.tokenType,
                {
                    tokenType: data.tokenType,
                    availableQuantity: data.availableQuantity ?? 0,
                    totalReceived: data.totalReceived ?? 0,
                },
            ];
        })
    );

    return types.map(
        (tokenType) =>
            map[tokenType] || {
                tokenType,
                availableQuantity: 0,
                totalReceived: 0,
            }
    );
};

exports.REASON_LABELS = REASON_LABELS;
