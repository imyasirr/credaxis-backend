const { verifyToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const MESSAGES = require("../constants/messages");
const ROLES = require("../constants/roles");
const userRepository = require("../modules/user/user.repository");
const roleRepository = require("../modules/role/role.repository");
const {
    canAuthenticate,
    STATUS_MESSAGES,
    getAllowedActions,
    USER_STATUS,
} = require("../constants/userStatusPolicy");

/**
 * Auth middleware: verify JWT, then load latest role + status from DB.
 * Role is not trusted from the token alone — after partner approve
 * (or any role change) the same token picks up the new role.
 *
 * BLOCKED / INACTIVE → no API access.
 * SUSPENDED → limited access (enforced via requireAction on routes).
 * ADMIN → must be ACTIVE (panel + admin APIs).
 */
module.exports = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            throw new ApiError(401, MESSAGES.UNAUTHORIZED);
        }

        const decoded = verifyToken(authHeader.split(" ")[1]);
        const user = await userRepository.findById(decoded.id);

        if (!user || user.isDeleted) {
            throw new ApiError(401, MESSAGES.UNAUTHORIZED);
        }

        if (!canAuthenticate(user.status)) {
            const err = new ApiError(
                403,
                STATUS_MESSAGES[user.status] || "Account access denied"
            );
            err.accountStatus = user.status;
            err.allowedActions = getAllowedActions(user.status);
            throw err;
        }

        const role = await roleRepository.findById(user.role);
        if (!role) {
            throw new ApiError(401, MESSAGES.UNAUTHORIZED);
        }

        if (
            role.name === ROLES.ADMIN &&
            user.status !== USER_STATUS.ACTIVE
        ) {
            throw new ApiError(
                403,
                "Admin account must be ACTIVE to use the panel"
            );
        }

        req.user = {
            id: user._id.toString(),
            role: role.name,
            status: user.status,
        };

        next();
    } catch (error) {
        if (error instanceof ApiError) {
            return next(error);
        }
        next(new ApiError(401, MESSAGES.UNAUTHORIZED));
    }
};
