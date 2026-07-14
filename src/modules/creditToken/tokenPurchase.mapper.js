exports.formatTokenPurchase = (purchase, profileMap = {}) => {
    if (!purchase) return null;

    const data = purchase.toObject ? purchase.toObject() : purchase;
    const user = data.user;
    const userId = user?._id?.toString() || user?.toString();
    const profile = profileMap[userId];

    return {
        id: data._id,
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
            : null,
        partner: data.partner?._id || data.partner || null,
        tokenPlan: data.tokenPlan?._id || data.tokenPlan,
        planTitle: data.planTitle,
        tokenType: data.tokenType,
        quantity: data.quantity,
        price: data.price,
        planType: data.planType || "NORMAL",
        paymentMethod: data.paymentMethod || "WALLET",
        transactionId: data.transactionId,
        walletTransaction: data.walletTransaction || null,
        razorpayOrderId: data.razorpayOrderId || null,
        razorpayPaymentId: data.razorpayPaymentId || null,
        failureReason: data.failureReason || "",
        status: data.status,
        purchasedAt: data.purchasedAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};
