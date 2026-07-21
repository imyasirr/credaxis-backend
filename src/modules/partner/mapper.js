exports.formatPartner = (partner) => {
    if (!partner) {
        return null;
    }

    const data = partner.toObject ? partner.toObject() : partner;

    return {
        id: data._id,
        userId: data.user?._id || data.user,
        userMobile: data.user?.mobile || null,
        businessName: data.businessName,
        businessType: data.businessType,
        ownerName: data.ownerName,
        email: data.email || "",
        gstNumber: data.gstNumber || "",
        panNumber: data.panNumber,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        country: data.country,
        shopPhoto: data.shopPhoto || null,
        gstDocument: data.gstDocument || null,
        panDocument: data.panDocument || null,
        partnerCode: data.partnerCode || null,
        commissionRate: data.commissionRate,
        totalReferrals: data.totalReferrals,
        totalEarnings: data.totalEarnings,
        status: data.status,
        remarks: data.remarks || "",
        approvedAt: data.approvedAt || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatReferral = (user, profile = null) => {
    const data = user?.toObject ? user.toObject() : user;

    return {
        id: data._id,
        mobile: data.mobile,
        status: data.status,
        isMobileVerified: data.isMobileVerified,
        firstName: profile?.firstName || "",
        lastName: profile?.lastName || "",
        fullName: profile
            ? [profile.firstName, profile.lastName].filter(Boolean).join(" ")
            : "",
        createdAt: data.createdAt,
    };
};

exports.formatReferralRecord = (referral, profile = null) => {
    const data = referral.toObject ? referral.toObject() : referral;
    const user = data.referredUser?.toObject
        ? data.referredUser.toObject()
        : data.referredUser;

    return {
        id: data._id,
        referredUserId: user?._id || data.referredUser,
        mobile: user?.mobile || null,
        userStatus: user?.status || null,
        isMobileVerified: user?.isMobileVerified || false,
        firstName: profile?.firstName || "",
        lastName: profile?.lastName || "",
        fullName: profile
            ? [profile.firstName, profile.lastName].filter(Boolean).join(" ")
            : "",
        referralStatus: data.status,
        rewardAmount: data.rewardAmount,
        rewardStatus: data.rewardStatus,
        referredAt: data.createdAt,
    };
};

exports.formatRegistrationStatus = ({
    step,
    canApply,
    canUpdate,
    nextAction,
    message,
    application,
}) => ({
    step,
    canApply,
    canUpdate,
    nextAction,
    message,
    application,
});
