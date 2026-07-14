const { verifyToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const MESSAGES = require("../constants/messages");
const userRepository = require("../modules/user/user.repository");
const roleRepository = require("../modules/role/role.repository");

/**
 * Auth middleware: verify JWT, then load latest role from DB.
 * Role is not trusted from the token alone — after partner approve
 * (or any role change) the same token picks up the new role.
 */
module.exports = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            throw new ApiError(401, MESSAGES.UNAUTHORIZED);
        }

        const decoded = verifyToken(authHeader.split(" ")[1]);
        const user = await userRepository.findById(decoded.id);

        if (!user) {
            throw new ApiError(401, MESSAGES.UNAUTHORIZED);
        }

        if (["BLOCKED", "SUSPENDED"].includes(user.status)) {
            throw new ApiError(403, "Account is blocked or suspended");
        }

        const role = await roleRepository.findById(user.role);
        if (!role) {
            throw new ApiError(401, MESSAGES.UNAUTHORIZED);
        }

        req.user = {
            id: user._id.toString(),
            role: role.name,
        };

        next();
    } catch (error) {
        if (error instanceof ApiError) {
            return next(error);
        }
        next(new ApiError(401, MESSAGES.UNAUTHORIZED));
    }
};
