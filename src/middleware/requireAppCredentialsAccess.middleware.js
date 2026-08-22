const crypto = require("crypto");
const ApiError = require("../utils/ApiError");

const readAccessKey = (req) => {
    const header =
        req.headers["x-app-credentials-access"] ||
        req.headers["x-appcredentials-access"];
    if (header && String(header).trim()) {
        return String(header).trim();
    }
    if (req.query?.access && String(req.query.access).trim()) {
        return String(req.query.access).trim();
    }
    if (req.body?.access && String(req.body.access).trim()) {
        return String(req.body.access).trim();
    }
    return null;
};

const safeEqual = (a, b) => {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
};

/**
 * Dev-only gate: client must send the same value as APP_CREDENTIALS_ACCESS.
 * Header: x-app-credentials-access (preferred) | Query/body: access
 */
module.exports = (req, res, next) => {
    try {
        const expected = process.env.APP_CREDENTIALS_ACCESS?.trim();
        if (!expected) {
            throw new ApiError(
                503,
                "App credentials access is not configured on server"
            );
        }

        const provided = readAccessKey(req);
        if (!provided || !safeEqual(provided, expected)) {
            throw new ApiError(403, "Invalid app credentials access key");
        }

        next();
    } catch (error) {
        next(error);
    }
};
