exports.formatUserReferral = (referral, profile = null) => {
    if (!referral) return null;

    const data = referral.toObject ? referral.toObject() : referral;
    const referred = data.referredUser;
    const referredId = referred?._id || referred;

    return {
        id: data._id,
        source: "USER",
        referralCode: data.referralCode,
        status: data.status,
        referrerRewardId: data.referrerRewardId || null,
        refereeRewardId: data.refereeRewardId || null,
        referredUser: referred
            ? {
                  id: referredId,
                  mobile: referred.mobile || "",
                  email: referred.email || "",
                  status: referred.status || "",
                  fullName: profile
                      ? [profile.firstName, profile.lastName]
                            .filter(Boolean)
                            .join(" ")
                      : "",
              }
            : null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatPartnerOwnedReferral = (referral, profile = null) => {
    if (!referral) return null;

    const data = referral.toObject ? referral.toObject() : referral;
    const referred = data.referredUser;
    const referredId = referred?._id || referred;

    return {
        id: data._id,
        source: "PARTNER",
        referralCode: data.partnerCode || data.referralCode || null,
        status: data.status,
        referrerRewardId: null,
        refereeRewardId: null,
        rewardAmount: data.rewardAmount ?? 0,
        rewardStatus: data.rewardStatus || "NONE",
        referredUser: referred
            ? {
                  id: referredId,
                  mobile: referred.mobile || "",
                  email: referred.email || "",
                  status: referred.status || "",
                  fullName: profile
                      ? [profile.firstName, profile.lastName]
                            .filter(Boolean)
                            .join(" ")
                      : "",
              }
            : null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatReferralSummary = ({
    referralCode,
    referralCount = 0,
    referredBy = null,
    partnerCode = null,
    partnerReferralCount = 0,
}) => ({
    referralCode: referralCode || null,
    referralCount,
    partnerCode: partnerCode || null,
    partnerReferralCount,
    totalReferralCount: Number(referralCount || 0) + Number(partnerReferralCount || 0),
    referredBy,
    shareMessage: referralCode
        ? `Join CredAxis using my referral code ${referralCode}`
        : partnerCode
          ? `Join CredAxis using my partner code ${partnerCode}`
          : null,
    instructions:
        "New users should enter this code while verifying OTP during signup",
});
