const rocketpayClient = require("../../../integrations/rocketpay/rocketpay.client");
const ApiError = require("../../../utils/ApiError");
const { writeApiLog } = require("./apiLog.service");
const {
    syncMandateFromRocketPay,
    syncInstallmentFromRocketPay,
} = require("./sync");

const isSuccessStatus = (code) => code >= 200 && code < 300;
const GENERIC_ROCKETPAY_ERRORS = new Set([
    "invalid_request_error",
    "api_error",
    "server_error",
]);

const normalizeErrorPayload = (payload) => {
    if (!payload) return null;
    if (typeof payload === "string") return payload.trim() || null;
    if (typeof payload !== "object") return String(payload);

    const pickString = (value) =>
        typeof value === "string" && value.trim() ? value.trim() : null;

    const tryPaths = [
        "message",
        "error_description",
        "error_message",
        "error",
        "msg",
        "detail",
    ];

    for (const path of tryPaths) {
        const result = pickString(payload[path]);
        if (result && !GENERIC_ROCKETPAY_ERRORS.has(result.toLowerCase())) {
            return result;
        }
    }

    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        return payload.errors
            .map((error) => normalizeErrorPayload(error) || String(error))
            .filter(Boolean)
            .join(". ");
    }

    if (payload.errors && typeof payload.errors === "object") {
        const nested = normalizeErrorPayload(payload.errors);
        if (nested) return nested;
    }

    if (payload.data && typeof payload.data === "object") {
        const nested = normalizeErrorPayload(payload.data);
        if (nested) return nested;
    }

    if (typeof payload.error_type === "string" && payload.error_type.trim()) {
        const title = payload.error_type.trim();
        const detail = [
            payload.error_description,
            payload.error,
            payload.message,
        ]
            .map(pickString)
            .find(
                (value) =>
                    value && !GENERIC_ROCKETPAY_ERRORS.has(value.toLowerCase())
            );
        return detail ? `${title}: ${detail}` : title;
    }

    return null;
};

const extractErrorMessage = (data, fallback) => {
    const normalized = normalizeErrorPayload(data);
    return normalized || fallback;
};

const logRocketPayFailure = ({ apiName, statusCode, errorMessage }) => {
    console.error(
        `[RocketPay] ${apiName} failed (${statusCode}): ${errorMessage}`
    );
};

/**
 * Call RocketPay, always persist API audit log, sync entity on success.
 */
exports.callRocketPay = async ({
    apiName,
    method,
    path,
    invoke,
    userId = null,
    ipAddress = null,
    requestBody = null,
    sync = null,
}) => {
    const started = Date.now();
    let statusCode = null;
    let responseData = null;
    let errorMessage = null;
    let status = "SUCCESS";

    try {
        const result = await invoke();
        statusCode = result.statusCode;
        responseData = result.data;

        if (!isSuccessStatus(statusCode)) {
            status = "FAILED";
            errorMessage = extractErrorMessage(
                responseData,
                `RocketPay ${apiName} failed`
            );
            if (
                String(responseData?.error_type).toLowerCase() ===
                "invalid_request_error" &&
                statusCode >= 500
            ) {
                statusCode = 400;
            }

            logRocketPayFailure({
                apiName,
                statusCode,
                errorMessage,
            });
        }
    } catch (err) {
        status = "ERROR";
        statusCode = err.statusCode || 502;
        errorMessage = err.message || `RocketPay ${apiName} error`;
        responseData = { error: errorMessage };
        logRocketPayFailure({ apiName, statusCode, errorMessage });

        await writeApiLog({
            userId,
            apiName,
            method,
            path,
            request: requestBody,
            response: responseData,
            statusCode,
            status,
            ipAddress,
            error: errorMessage,
            durationMs: Date.now() - started,
        });

        if (err instanceof ApiError) throw err;
        throw new ApiError(502, errorMessage);
    }

    let synced = null;
    // DELETE may return 204 / empty body — still run sync so callers can soft-delete locally
    if (status === "SUCCESS" && typeof sync === "function") {
        try {
            synced = await sync(responseData ?? null);
        } catch (syncErr) {
            console.error(
                `RocketPay sync after ${apiName} failed:`,
                syncErr.message
            );
        }
    }

    const rpMandateId =
        responseData?.mandate_id ||
        requestBody?.mandate_id ||
        (responseData?.frequency || responseData?.approval_amount != null
            ? responseData?.id
            : null) ||
        null;

    const rpInstallmentId =
        responseData?.mandate_id && responseData?.id
            ? responseData.id
            : requestBody?.installment_id || null;

    await writeApiLog({
        userId,
        apiName,
        method,
        path,
        request: requestBody,
        response: responseData,
        statusCode,
        status,
        ipAddress,
        error: errorMessage,
        rocketpayMandateId: rpMandateId ? String(rpMandateId) : null,
        rocketpayInstallmentId: rpInstallmentId
            ? String(rpInstallmentId)
            : null,
        durationMs: Date.now() - started,
    });

    if (status !== "SUCCESS") {
        throw new ApiError(statusCode >= 400 ? statusCode : 502, errorMessage);
    }

    return { data: responseData, synced };
};

exports.createMandate = (body, ctx) =>
    exports.callRocketPay({
        apiName: "CREATE_MANDATE",
        method: "POST",
        path: "/v4/mandates",
        requestBody: body,
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.createMandate(body),
        sync: async (data) =>
            syncMandateFromRocketPay(data, {
                userId: ctx.userId,
                referenceId: body.reference_id || null,
                schedule: body.schedule || null,
                source: ctx.source || "API",
                distributor: ctx.distributor || null,
                clientMetaOverride: body.client_meta || null,
            }),
    });

exports.getMandate = (mandateId, ctx) =>
    exports.callRocketPay({
        apiName: "GET_MANDATE",
        method: "GET",
        path: `/v4/mandates/${mandateId}`,
        requestBody: { mandate_id: mandateId },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.getMandate(mandateId),
        sync: async (data) =>
            syncMandateFromRocketPay(data, {
                userId: ctx.userId,
                source: ctx.source || "API",
            }),
    });

exports.refreshMandate = (mandateId, ctx) =>
    exports.callRocketPay({
        apiName: "REFRESH_MANDATE",
        method: "POST",
        path: `/v4/mandates/${mandateId}/refresh`,
        requestBody: { mandate_id: mandateId },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.refreshMandate(mandateId),
        sync: async (data) =>
            syncMandateFromRocketPay(data, {
                userId: ctx.userId,
                source: ctx.source || "API",
            }),
    });

exports.deleteMandate = (mandateId, ctx) =>
    exports.callRocketPay({
        apiName: "DELETE_MANDATE",
        method: "DELETE",
        path: `/v4/mandates/${mandateId}`,
        requestBody: { mandate_id: mandateId },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.deleteMandate(mandateId),
        sync: async (data) => {
            const entity = data?.id ? data : data?.data?.id ? data.data : null;
            if (entity?.id) {
                return syncMandateFromRocketPay(
                    { ...entity, deleted: true },
                    {
                        userId: ctx.userId,
                        source: ctx.source || "API",
                    }
                );
            }

            // Empty DELETE body — mark existing local row deleted without wiping fields
            const Mandate = require("./mandate.model");
            return Mandate.findOneAndUpdate(
                { rocketpayId: String(mandateId) },
                { $set: { deleted: true, lastSyncedAt: new Date() } },
                { new: true }
            );
        },
    });

exports.cancelMandate = (mandateId, ctx) =>
    exports.callRocketPay({
        apiName: "CANCEL_MANDATE",
        method: "POST",
        path: `/v4/mandates/${mandateId}/cancel`,
        requestBody: { mandate_id: mandateId },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.cancelMandate(mandateId),
        sync: async (data) =>
            syncMandateFromRocketPay(data, {
                userId: ctx.userId,
                source: ctx.source || "API",
            }),
    });

exports.reconMandates = (body, ctx) =>
    exports.callRocketPay({
        apiName: "RECON_MANDATES",
        method: "POST",
        path: "/v4/mandates/recon",
        requestBody: body,
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.reconMandates(body),
        sync: async (data) => {
            const list = Array.isArray(data?.items)
                ? data.items
                : Array.isArray(data)
                  ? data
                  : [];
            const synced = [];
            for (const item of list) {
                const doc = await syncMandateFromRocketPay(item, {
                    // Do not pass admin userId — preserve original owners
                    source: ctx.source || "API",
                });
                if (doc) synced.push(doc);
            }
            return synced;
        },
    });

exports.createInstallment = (mandateId, body, ctx) =>
    exports.callRocketPay({
        apiName: "CREATE_INSTALLMENT",
        method: "POST",
        path: `/v4/mandates/${mandateId}/installment`,
        requestBody: { mandate_id: mandateId, ...body },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.createInstallment(mandateId, body),
        sync: async (data) =>
            syncInstallmentFromRocketPay(data, {
                userId: ctx.userId,
                source: ctx.source || "API",
            }),
    });

exports.listInstallments = (mandateId, ctx) =>
    exports.callRocketPay({
        apiName: "LIST_INSTALLMENTS",
        method: "GET",
        path: `/v4/installments?mandate_id=${mandateId}`,
        requestBody: { mandate_id: mandateId },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.listInstallments(mandateId),
        sync: async (data) => {
            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.data)
                        ? data.data
                        : Array.isArray(data?.installments)
                            ? data.installments
                            : [];
            const synced = [];
            for (const item of list) {
                const doc = await syncInstallmentFromRocketPay(item, {
                    userId: ctx.userId,
                    source: ctx.source || "API",
                });
                if (doc) synced.push(doc);
            }
            return synced;
        },
    });

exports.getInstallment = (installmentId, ctx) =>
    exports.callRocketPay({
        apiName: "GET_INSTALLMENT",
        method: "GET",
        path: `/v4/installments/${installmentId}`,
        requestBody: { installment_id: installmentId },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.getInstallment(installmentId),
        sync: async (data) =>
            syncInstallmentFromRocketPay(data, {
                userId: ctx.userId,
                source: ctx.source || "API",
            }),
    });

exports.refreshInstallment = (installmentId, ctx) =>
    exports.callRocketPay({
        apiName: "REFRESH_INSTALLMENT",
        method: "POST",
        path: `/v4/installments/${installmentId}/refresh`,
        requestBody: { installment_id: installmentId },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.refreshInstallment(installmentId),
        sync: async (data) =>
            syncInstallmentFromRocketPay(data, {
                userId: ctx.userId,
                source: ctx.source || "API",
            }),
    });

exports.skipInstallment = (installmentId, ctx) =>
    exports.callRocketPay({
        apiName: "SKIP_INSTALLMENT",
        method: "POST",
        path: `/v4/installments/${installmentId}/skip`,
        requestBody: { installment_id: installmentId },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.skipInstallment(installmentId),
        sync: async (data) =>
            syncInstallmentFromRocketPay(data, {
                userId: ctx.userId,
                source: ctx.source || "API",
            }),
    });

exports.retryInstallment = (installmentId, body, ctx) =>
    exports.callRocketPay({
        apiName: "RETRY_INSTALLMENT",
        method: "POST",
        path: `/v4/installments/${installmentId}/retry`,
        requestBody: { installment_id: installmentId, ...body },
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.retryInstallment(installmentId, body),
        sync: async (data) =>
            syncInstallmentFromRocketPay(data, {
                userId: ctx.userId,
                source: ctx.source || "API",
            }),
    });

exports.reconInstallments = (body, ctx) =>
    exports.callRocketPay({
        apiName: "RECON_INSTALLMENTS",
        method: "POST",
        path: "/v4/installments/recon",
        requestBody: body,
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        invoke: () => rocketpayClient.reconInstallments(body),
        sync: async (data) => {
            const list = Array.isArray(data?.items)
                ? data.items
                : Array.isArray(data)
                  ? data
                  : [];
            const synced = [];
            for (const item of list) {
                const doc = await syncInstallmentFromRocketPay(item, {
                    source: ctx.source || "API",
                });
                if (doc) synced.push(doc);
            }
            return synced;
        },
    });
