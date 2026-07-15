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

    return res.status(statusCode).json(body);
};
