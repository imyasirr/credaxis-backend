const ApiError = require("../../../utils/ApiError");

exports.getRocketPayCredentials = () => {
    const enterpriseId = process.env.ENTERPRISE_ID?.trim() || null;
    const token =
        process.env.ROCKETPAY_SUPERKEY_TOKEN?.trim() ||
        process.env.ROCKETPAY_TOKEN?.trim() ||
        null;
    const supportNumber = process.env.ROCKETPAY_SUPPORT_NUMBER?.trim() || null;
    const baseUrl =
        process.env.ROCKETPAY_BASE_URL?.trim() ||
        "https://api-staging.rocketpay.co.in";
    const appContext =
        process.env.ROCKETPAY_APP_CONTEXT?.trim() || "MERCHANT_API";

    if (!enterpriseId && !token) {
        throw new ApiError(503, "RocketPay credentials are not configured");
    }

    return {
        enterpriseId,
        token,
        supportNumber,
        baseUrl,
        appContext,
    };
};
