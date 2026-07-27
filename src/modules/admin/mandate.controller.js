const adminMandateService = require("./mandate.service");
const { getClientIp } = require("../mandate/apiLog.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getDashboard = asyncHandler(async (req, res) => {
    const data = await adminMandateService.getDashboard();
    return response.success(res, "Mandate dashboard fetched", data);
});

exports.getMandates = asyncHandler(async (req, res) => {
    const data = await adminMandateService.getMandates(req.query);
    return response.success(res, "Mandates fetched successfully", data);
});

exports.getMandateById = asyncHandler(async (req, res) => {
    const data = await adminMandateService.getMandateById(req.params.id);
    return response.success(res, "Mandate fetched successfully", data);
});

exports.refreshMandate = asyncHandler(async (req, res) => {
    const data = await adminMandateService.refreshMandate(
        req.params.id,
        req.user.id,
        getClientIp(req)
    );
    return response.success(res, "Mandate refreshed successfully", data);
});

exports.cancelMandate = asyncHandler(async (req, res) => {
    const data = await adminMandateService.cancelMandate(
        req.params.id,
        req.user.id,
        getClientIp(req)
    );
    return response.success(res, "Mandate cancelled successfully", data);
});

exports.getInstallments = asyncHandler(async (req, res) => {
    const data = await adminMandateService.getInstallments(req.query);
    return response.success(res, "Installments fetched successfully", data);
});

exports.getInstallmentById = asyncHandler(async (req, res) => {
    const data = await adminMandateService.getInstallmentById(req.params.id);
    return response.success(res, "Installment fetched successfully", data);
});

exports.refreshInstallment = asyncHandler(async (req, res) => {
    const data = await adminMandateService.refreshInstallment(
        req.params.id,
        req.user.id,
        getClientIp(req)
    );
    return response.success(res, "Installment refreshed successfully", data);
});

exports.skipInstallment = asyncHandler(async (req, res) => {
    const data = await adminMandateService.skipInstallment(
        req.params.id,
        req.user.id,
        getClientIp(req)
    );
    return response.success(res, "Installment skipped successfully", data);
});

exports.retryInstallment = asyncHandler(async (req, res) => {
    const data = await adminMandateService.retryInstallment(
        req.params.id,
        req.body,
        req.user.id,
        getClientIp(req)
    );
    return response.success(res, "Installment retry scheduled", data);
});

exports.getTransactions = asyncHandler(async (req, res) => {
    const data = await adminMandateService.getTransactions(req.query);
    return response.success(res, "Mandate transactions fetched", data);
});

exports.getWebhookLogs = asyncHandler(async (req, res) => {
    const data = await adminMandateService.getWebhookLogs(req.query);
    return response.success(res, "Webhook logs fetched", data);
});

exports.getApiLogs = asyncHandler(async (req, res) => {
    const data = await adminMandateService.getApiLogs(req.query);
    return response.success(res, "API logs fetched", data);
});
