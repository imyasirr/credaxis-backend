exports.formatUserReferral = (referral, profile = null) => {
    if (!referral) return null;

    const data = referral.toObject ? referral.toObject() : referral;
    const referred = data.referredUser;
    const referredId = referred?._id || referred;

    return {
        id: data._id,
        referralCode: data.referralCode,
        status: data.status,
        referrerRewardId: data.referrerRewardId || null,
        refereeRewardId: data.refereeRewardId || null,
        referredUser: referred
            ? {
                  id: referredId,
                  mobile: referred.mobile || "",
                  email: referred.email || "",
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
}) => ({
    referralCode: referralCode || null,
    referralCount,
    referredBy,
    shareMessage: referralCode
        ? `Join CredAxis using my referral code ${referralCode}`
        : null,
    instructions:
        "New users should enter this code while verifying OTP during signup",
});
