exports.formatWheelPrize = (prize, probability = null) => {
    if (!prize) return null;

    const data = prize.toObject ? prize.toObject() : prize;

    return {
        id: data._id,
        title: data.title,
        description: data.description || "",
        prizeType: data.prizeType,
        value: data.value ?? 0,
        frequency: data.frequency,
        color: data.color || "#6366f1",
        status: data.status,
        sortOrder: data.sortOrder ?? 0,
        expiryDays: data.expiryDays ?? 30,
        probability,
        createdBy: data.createdBy || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};
