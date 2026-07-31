module.exports = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    if (statusCode >= 500) {
        console.error(err);
    }

    const body = {
        success: false,
        message: err.message || "Internal Server Error",
    };

    if (err.retryAfterSeconds != null) {
        body.retryAfterSeconds = err.retryAfterSeconds;
    }

    if (err.accountStatus) {
        body.accountStatus = err.accountStatus;
    }

    if (err.allowedActions) {
        body.allowedActions = err.allowedActions;
    }

    if (err.details) {
        body.details = err.details;
    }

    return res.status(statusCode).json(body);
};
