const creditCheckFeeService = require("../../api/payments/creditCheckFee.service");
const mandateCreateFeeService = require("../../api/payments/mandateCreateFee.service");
const mandateInstallmentFeeService = require("../../api/payments/mandateInstallmentFee.service");
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

exports.getMandateCreateFee = asyncHandler(async (_req, res) => {
    const data = await mandateCreateFeeService.getMandateCreateFeeSetting();
    return response.success(res, "Mandate create fee fetched", data);
});

exports.updateMandateCreateFee = asyncHandler(async (req, res) => {
    const data = await mandateCreateFeeService.updateMandateCreateFeeSetting(
        req.body
    );
    return response.success(res, "Mandate create fee updated", data);
});

exports.getMandateInstallmentFee = asyncHandler(async (_req, res) => {
    const data =
        await mandateInstallmentFeeService.getMandateInstallmentFeeSetting();
    return response.success(res, "Mandate installment fee fetched", data);
});

exports.updateMandateInstallmentFee = asyncHandler(async (req, res) => {
    const data =
        await mandateInstallmentFeeService.updateMandateInstallmentFeeSetting(
            req.body
        );
    return response.success(res, "Mandate installment fee updated", data);
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
