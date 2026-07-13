const { verifyToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const MESSAGES = require("../constants/messages");

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            throw new ApiError(401, MESSAGES.UNAUTHORIZED);
        }

        req.user = verifyToken(authHeader.split(" ")[1]);
        next();
    } catch {
        next(new ApiError(401, MESSAGES.UNAUTHORIZED));
    }
};
