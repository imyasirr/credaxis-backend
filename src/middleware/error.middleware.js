module.exports = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    if (statusCode >= 500) {
        console.error(err);
    }

    return res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
};
