const MandateWebhookLog = require("./webhookLog.model");
const {
    syncMandateFromRocketPay,
    syncInstallmentFromRocketPay,
    isMandateEntity,
} = require("./sync");
const { getClientIp } = require("./apiLog.service");
const ApiError = require("../../../utils/ApiError");

const sanitizeHeaders = (headers = {}) => {
    const copy = { ...headers };
    delete copy.authorization;
    delete copy.cookie;
    delete copy["x-token"];
    return copy;
};

/**
 * RocketPay webhook — stores payload and syncs mandate / installment.
 * Optional ROCKETPAY_WEBHOOK_SECRET via header x-webhook-secret.
 */
exports.handleWebhook = async (req) => {
    const secret = process.env.ROCKETPAY_WEBHOOK_SECRET;
    if (secret) {
        const provided =
            req.headers["x-webhook-secret"] ||
            req.headers["x-rocketpay-secret"];
        if (provided !== secret) {
            throw new ApiError(401, "Invalid webhook secret");
        }
    }

    const payload = req.body;
    if (!payload || typeof payload !== "object") {
        throw new ApiError(400, "Invalid webhook payload");
    }

    const entityIsMandate = isMandateEntity(payload);
    const entityType = entityIsMandate
        ? "MANDATE"
        : payload.mandate_id
          ? "INSTALLMENT"
          : "UNKNOWN";

    const log = await MandateWebhookLog.create({
        entityType,
        rocketpayEntityId: payload.id ? String(payload.id) : null,
        payload,
        headers: sanitizeHeaders(req.headers),
        ipAddress: getClientIp(req),
        processed: false,
    });

    try {
        if (entityType === "MANDATE") {
            const mandate = await syncMandateFromRocketPay(payload, {
                source: "WEBHOOK",
            });
            log.mandate = mandate?._id || null;
        } else if (entityType === "INSTALLMENT") {
            const installment = await syncInstallmentFromRocketPay(payload, {
                source: "WEBHOOK",
            });
            log.installment = installment?._id || null;
            log.mandate = installment?.mandate || null;
        }

        log.processed = true;
        await log.save();
    } catch (err) {
        log.processError = err.message;
        log.processed = false;
        await log.save();
        throw new ApiError(500, `Webhook processing failed: ${err.message}`);
    }

    return {
        received: true,
        entityType,
        rocketpayEntityId: log.rocketpayEntityId,
        webhookLogId: log._id,
    };
};
