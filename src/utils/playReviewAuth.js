/** Normalize to last 10 digits (Indian mobile). */
const normalizeMobile = (mobile) =>
    String(mobile || "")
        .replace(/\D/g, "")
        .slice(-10);

/**
 * Play Store / app-review demo login (env-gated).
 * Set PLAY_REVIEW_MOBILE + PLAY_REVIEW_OTP on production when submitting to Play Console.
 */
exports.getPlayReviewConfig = () => {
    const mobile = normalizeMobile(process.env.PLAY_REVIEW_MOBILE);
    const otp = String(process.env.PLAY_REVIEW_OTP || "").trim();

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile) || !/^\d{6}$/.test(otp)) {
        return null;
    }

    return { mobile, otp };
};

exports.isPlayReviewMobile = (mobile) => {
    const cfg = exports.getPlayReviewConfig();
    return Boolean(cfg && normalizeMobile(mobile) === cfg.mobile);
};

exports.isPlayReviewLogin = (mobile, otp) => {
    const cfg = exports.getPlayReviewConfig();
    if (!cfg) return false;
    return (
        normalizeMobile(mobile) === cfg.mobile &&
        String(otp || "").trim() === cfg.otp
    );
};

exports.normalizeMobile = normalizeMobile;
