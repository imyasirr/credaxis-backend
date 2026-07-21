const User = require("../modules/user/model");

/**
 * Generate unique user referral code: USR + 6 chars.
 */
exports.generateUserReferralCode = async () => {
    let code;
    let exists = true;

    while (exists) {
        code = "USR" + Math.random().toString(36).substring(2, 8).toUpperCase();
        exists = await User.exists({ referralCode: code });
    }

    return code;
};

/**
 * Ensure user has a personal referral code (backfill for old accounts).
 */
exports.ensureUserReferralCode = async (user) => {
    if (user.referralCode) {
        return user.referralCode;
    }

    const code = await exports.generateUserReferralCode();
    user.referralCode = code;
    await user.save();
    return code;
};
