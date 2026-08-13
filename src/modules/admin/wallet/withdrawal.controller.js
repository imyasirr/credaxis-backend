const withdrawalService = require("../../api/wallet/withdrawal.service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.list = asyncHandler(async (req, res) => {
    const data = await withdrawalService.adminListWithdrawals(req.query);
    return response.success(res, "Withdrawals fetched", data);
});

exports.getById = asyncHandler(async (req, res) => {
    const data = await withdrawalService.adminGetWithdrawalById(req.params.id);
    return response.success(res, "Withdrawal fetched", data);
});

exports.initiate = asyncHandler(async (req, res) => {
    const data = await withdrawalService.adminInitiatePayout(
        req.params.id,
        req.user.id,
        req.body
    );
    return response.success(res, "Payout initiated", data);
});

exports.markSuccess = asyncHandler(async (req, res) => {
    const data = await withdrawalService.adminMarkSuccess(
        req.params.id,
        req.user.id,
        req.body
    );
    return response.success(res, "Withdrawal marked successful", data);
});

exports.reject = asyncHandler(async (req, res) => {
    const data = await withdrawalService.adminReject(
        req.params.id,
        req.user.id,
        req.body
    );
    return response.success(res, "Withdrawal rejected", data);
});

exports.markFailed = asyncHandler(async (req, res) => {
    const data = await withdrawalService.adminMarkFailed(
        req.params.id,
        req.user.id,
        req.body
    );
    return response.success(res, "Withdrawal marked failed", data);
});

exports.updateExpected = asyncHandler(async (req, res) => {
    const data = await withdrawalService.adminUpdateExpectedAt(
        req.params.id,
        req.user.id,
        req.body
    );
    return response.success(res, "Expected date updated", data);
});
