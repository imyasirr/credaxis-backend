const resolveStatus = (reward) => {
    const data = reward.toObject ? reward.toObject() : reward;

    if (data.status === "CLAIMED" || data.status === "CANCELLED") {
        return data.status;
    }

    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        return "EXPIRED";
    }

    return data.status || "PENDING";
};

exports.formatUserReward = (reward, profileMap = {}) => {
    if (!reward) return null;

    const data = reward.toObject ? reward.toObject() : reward;
    const user = data.user;
    const userId = user?._id?.toString() || user?.toString();
    const profile = profileMap[userId];
    const status = resolveStatus(data);

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
        gameType: data.gameType,
        prizeId: data.prizeId,
        prizeTitle: data.prizeTitle,
        prizeType: data.prizeType,
        value: data.value ?? 0,
        color: data.color || "#6366f1",
        expiryDays: data.expiryDays ?? 0,
        status,
        isUsed: status === "CLAIMED",
        wonAt: data.wonAt,
        expiresAt: data.expiresAt,
        claimedAt: data.claimedAt,
        source: data.source || "OTHER",
        ruleId: data.ruleId || null,
        grantedBy: data.grantedBy || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.computeExpiresAt = (expiryDays, wonAt = new Date()) => {
    const days = Number(expiryDays);

    if (!days || days <= 0) {
        return null;
    }

    return new Date(wonAt.getTime() + days * 86400000);
};
