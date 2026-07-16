const ApiError = require("../utils/ApiError");
const {
    canPerform,
    assertCanPerform,
    STATUS_MESSAGES,
    getAllowedActions,
} = require("../constants/userStatusPolicy");

/**
 * Require one action (or any of several = OR). Use after auth middleware.
 * Example: requireAction(ACTIONS.WALLET_WRITE)
 */
module.exports = (...actions) => {
    return (req, res, next) => {
        try {
            const status = req.user?.status;

            if (!status) {
                throw new ApiError(401, "Unauthorized");
            }

            if (actions.some((action) => canPerform(status, action))) {
                return next();
            }

            const primary = actions[0];
            assertCanPerform(status, primary, ApiError);
        } catch (error) {
            if (error instanceof ApiError && !error.allowedActions) {
                error.allowedActions = getAllowedActions(req.user?.status);
                error.message =
                    STATUS_MESSAGES[req.user?.status] || error.message;
            }
            next(error);
        }
    };
};
