const authService = require("./auth.service");
const userReferralService = require("../user/userReferral.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");
const MESSAGES = require("../../constants/messages");

exports.mobileAuth = asyncHandler(async (req, res) => {
    const result = await authService.mobileAuth(req.body.mobile.trim());

    return response.success(res, MESSAGES.OTP_SENT, result);
});

exports.verifyOtp = asyncHandler(async (req, res) => {
    const result = await authService.verifyOtp(
        req.body.mobile.trim(),
        req.body.otp.trim(),
        {
            partnerCode: req.body.partnerCode?.trim(),
            referralCode: req.body.referralCode?.trim(),
        }
    );

    const message = result.isNewUser
        ? MESSAGES.USER_CREATED
        : MESSAGES.LOGIN_SUCCESS;

    const status = result.isNewUser ? 201 : 200;

    return response.success(res, message, result, status);
});

exports.validateReferralCode = asyncHandler(async (req, res) => {
    const data = await userReferralService.validateReferralCode(req.params.code);
    return response.success(res, "Referral code validated", data);
});
