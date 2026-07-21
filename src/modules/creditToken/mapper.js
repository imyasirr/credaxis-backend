exports.formatCreditToken = (token) => {
    if (!token) return null;

    const data = token.toObject ? token.toObject() : token;

    return {
        id: data._id,
        title: data.title,
        description: data.description || "",
        tokenType: data.tokenType || data.badge || "CRIF",
        planType: data.planType || "NORMAL",
        badge: data.badge || "",
        price: data.price,
        quantity: data.quantity,
        status: data.status,
        sortOrder: data.sortOrder ?? 0,
        createdBy: data.createdBy || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};
