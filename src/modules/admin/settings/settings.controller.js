const creditCheckFeeService = require("../../api/payments/creditCheckFee.service");
const firstTopupBonusService = require("../../api/wallet/firstTopupBonus.service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.getCreditCheckFee = asyncHandler(async (_req, res) => {
    const data = await creditCheckFeeService.getCreditCheckFeeSetting();
    return response.success(res, "Credit check fee fetched", data);
});

exports.updateCreditCheckFee = asyncHandler(async (req, res) => {
    const data = await creditCheckFeeService.updateCreditCheckFeeSetting(
        req.body
    );
    return response.success(res, "Credit check fee updated", data);
});

exports.getFirstTopupBonus = asyncHandler(async (_req, res) => {
    const data = await firstTopupBonusService.getFirstTopupBonusSetting();
    return response.success(res, "First top-up bonus setting fetched", data);
});

exports.updateFirstTopupBonus = asyncHandler(async (req, res) => {
    const data = await firstTopupBonusService.updateFirstTopupBonusSetting(
        req.body
    );
    return response.success(res, "First top-up bonus setting updated", data);
});
