const ApiError = require("../utils/ApiError");
const MESSAGES = require("../constants/messages");

module.exports = (...roles) => {
    return (req, res, next) => {
        if (!req.user?.role) {
            return next(new ApiError(401, MESSAGES.UNAUTHORIZED));
        }

        if (!roles.includes(req.user.role)) {
            return next(new ApiError(403, "Access denied"));
        }

        next();
    };
};
