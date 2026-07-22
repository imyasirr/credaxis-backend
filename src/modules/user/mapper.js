exports.formatProfile = (profile) => {
    if (!profile) {
        return null;
    }

    const data = profile.toObject ? profile.toObject() : profile;

    return {
        id: data._id,
        userId: data.user,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        fullName:
            data.fullName ||
            [data.firstName, data.lastName].filter(Boolean).join(" "),
        gender: data.gender || null,
        dob: data.dob || null,
        avatar: data.avatar || null,
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        country: data.country || "India",
        pincode: data.pincode || "",
        isProfileComplete: data.isProfileComplete || false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatAuthUser = (
    user,
    profile,
    role,
    referral = null,
    partnerAccount = null
) => {
    const profileData = profile?.toObject?.() || profile || {};
    const {
        getAllowedActions,
        STATUS_MESSAGES,
    } = require("../../constants/userStatusPolicy");

    const firstName = profileData.firstName || "";
    const lastName = profileData.lastName || "";
    const fullName =
        profileData.fullName ||
        [firstName, lastName].filter(Boolean).join(" ");

    return {
        id: user._id,
        firstName,
        lastName,
        fullName,
        mobile: user.mobile,
        countryCode: user.countryCode || "+91",
        role: role?.name || role,
        status: user.status,
        statusMessage: STATUS_MESSAGES[user.status] || null,
        allowedActions: getAllowedActions(user.status),
        isMobileVerified: user.isMobileVerified,
        isEmailVerified: user.isEmailVerified,
        isProfileComplete: profileData.isProfileComplete || false,
        avatar: profileData.avatar || null,
        referralCode: referral?.referralCode || user.referralCode || null,
        referralCount: referral?.referralCount ?? 0,
        referredBy: referral?.referredBy || null,
        partnerAccount: partnerAccount || {
            status: null,
            isApproved: false,
            partnerCode: null,
            partnerAppUrl: null,
            message: "You have not applied as a partner yet",
            nextAction: "apply",
        },
        createdAt: user.createdAt,
    };
};

exports.formatAuthPayload = ({ isNewUser, redirectTo, token, user }) => ({
    isNewUser,
    redirectTo,
    token,
    user,
});

exports.getAuthRedirect = (profile) => {
    const data = profile?.toObject?.() || profile || {};
    return data.isProfileComplete ? "dashboard" : "complete-profile";
};
