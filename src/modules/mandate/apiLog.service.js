const MandateApiLog = require("./apiLog.model");

exports.writeApiLog = async ({
    userId = null,
    apiName,
    method = null,
    path = null,
    request = null,
    response = null,
    statusCode = null,
    status = "SUCCESS",
    ipAddress = null,
    error = null,
    rocketpayMandateId = null,
    rocketpayInstallmentId = null,
    durationMs = null,
}) => {
    try {
        return await MandateApiLog.create({
            user: userId || null,
            apiName,
            method,
            path,
            request,
            response,
            statusCode,
            status,
            ipAddress,
            error,
            rocketpayMandateId,
            rocketpayInstallmentId,
            durationMs,
        });
    } catch (err) {
        console.error("Mandate API log failed:", err.message);
        return null;
    }
};

exports.getClientIp = (req) => {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
};
