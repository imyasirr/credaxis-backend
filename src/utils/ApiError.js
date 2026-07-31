class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        if (details != null) {
            this.details = details;
        }
    }
}

module.exports = ApiError;
