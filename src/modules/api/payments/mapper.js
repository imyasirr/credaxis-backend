exports.formatPayment = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;

    return {
        id: data._id,
        purpose: data.purpose,
        method: data.method || "ONLINE",
        amount: data.amount,
        currency: data.currency || "INR",
        status: data.status,
        description: data.description || "",
        razorpayOrderId: data.razorpayOrderId || null,
        razorpayPaymentId: data.razorpayPaymentId || null,
        receipt: data.receipt || null,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        meta: data.meta || {},
        paidAt: data.paidAt || null,
        consumedAt: data.consumedAt || null,
        failureReason: data.failureReason || "",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};
