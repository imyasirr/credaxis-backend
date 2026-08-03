const mandateService = require("./service");
const webhookService = require("./webhook.service");
const { getClientIp } = require("./apiLog.service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.createMandate = asyncHandler(async (req, res) => {
    const data = await mandateService.createMandate(
        req.user.id,
        req.body,
        getClientIp(req)
    );
    return response.success(res, "Mandate created successfully", data, 201);
});

exports.listMandates = asyncHandler(async (req, res) => {
    const data = await mandateService.listMyMandates(req.user.id, req.query);
    return response.success(res, "Mandates fetched successfully", data);
});

exports.getMandate = asyncHandler(async (req, res) => {
    const refresh =
        req.query.refresh === "true" || req.query.refresh === "1";
    const data = await mandateService.getMandate(
        req.user.id,
        req.params.id,
        getClientIp(req),
        { refresh }
    );
    return response.success(res, "Mandate fetched successfully", data);
});

exports.refreshMandate = asyncHandler(async (req, res) => {
    const data = await mandateService.refreshMandate(
        req.user.id,
        req.params.id,
        getClientIp(req)
    );
    return response.success(res, "Mandate refreshed successfully", data);
});

exports.deleteMandate = asyncHandler(async (req, res) => {
    const data = await mandateService.deleteMandate(
        req.user.id,
        req.params.id,
        getClientIp(req)
    );
    return response.success(res, "Mandate deleted successfully", data);
});

exports.cancelMandate = asyncHandler(async (req, res) => {
    const data = await mandateService.cancelMandate(
        req.user.id,
        req.params.id,
        getClientIp(req)
    );
    return response.success(res, "Mandate cancelled successfully", data);
});

exports.createInstallment = asyncHandler(async (req, res) => {
    const data = await mandateService.createInstallment(
        req.user.id,
        req.params.id,
        req.body,
        getClientIp(req)
    );
    return response.success(res, "Installment created successfully", data, 201);
});

exports.listInstallmentsByMandate = asyncHandler(async (req, res) => {
    const mandateId = req.query.mandate_id || req.params.id;
    const data = await mandateService.listInstallments(
        req.user.id,
        mandateId,
        getClientIp(req),
        req.query
    );
    return response.success(res, "Installments fetched successfully", data);
});

exports.getInstallment = asyncHandler(async (req, res) => {
    const refresh =
        req.query.refresh === "true" || req.query.refresh === "1";
    const data = await mandateService.getInstallment(
        req.user.id,
        req.params.id,
        getClientIp(req),
        { refresh }
    );
    return response.success(res, "Installment fetched successfully", data);
});

exports.refreshInstallment = asyncHandler(async (req, res) => {
    const data = await mandateService.refreshInstallment(
        req.user.id,
        req.params.id,
        getClientIp(req)
    );
    return response.success(res, "Installment refreshed successfully", data);
});

exports.skipInstallment = asyncHandler(async (req, res) => {
    const data = await mandateService.skipInstallment(
        req.user.id,
        req.params.id,
        getClientIp(req)
    );
    return response.success(res, "Installment skipped successfully", data);
});

exports.retryInstallment = asyncHandler(async (req, res) => {
    const data = await mandateService.retryInstallment(
        req.user.id,
        req.params.id,
        req.body,
        getClientIp(req)
    );
    return response.success(res, "Installment retry scheduled", data);
});

exports.webhook = asyncHandler(async (req, res) => {
    const data = await webhookService.handleWebhook(req);
    return response.success(res, "Webhook received", data);
});
