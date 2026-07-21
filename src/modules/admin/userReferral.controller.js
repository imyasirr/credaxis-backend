const userReferralService = require("../user/referral.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getUserReferralSetting = asyncHandler(async (req, res) => {
    const data = await userReferralService.getReferralSetting();
    return response.success(res, "User referral settings fetched", data);
});

exports.updateUserReferralSetting = asyncHandler(async (req, res) => {
    const data = await userReferralService.updateReferralSetting(req.body);
    return response.success(res, "User referral settings updated", data);
});

exports.getUserReferrals = asyncHandler(async (req, res) => {
    const data = await userReferralService.getAdminReferrals(req.query);
    return response.success(res, "User referrals fetched", data);
});
