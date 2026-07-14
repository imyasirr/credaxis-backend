const ApiError = require("../utils/ApiError");
const MESSAGES = require("../constants/messages");

module.exports = (...roles) => {
    return (req, res, next) => {
        // Laravel-style debug (optional): uncomment while debugging
        // console.log("AUTH USER:", req.user);
        // console.log("REQUIRED ROLES:", roles);

        if (!req.user?.role) {
            return next(new ApiError(401, MESSAGES.UNAUTHORIZED));
        }

        if (!roles.includes(req.user.role)) {
            return next(
                new ApiError(
                    403,
                    `Access denied. Required role: ${roles.join(" or ")}. Your role: ${req.user.role}`
                )
            );
        }

        next();
    };
};
