const ApiError = require("../utils/ApiError");
const { getPartnerAccess } = require("../modules/partner/access");

/**
 * Partner-app routes: user must have an APPROVED Partner application.
 * User.role stays USER — approval is tracked on the Partner document.
 */
module.exports = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            throw new ApiError(401, "Unauthorized");
        }

        const access = await getPartnerAccess(req.user.id);

        if (!access.isApproved) {
            throw new ApiError(
                403,
                access.status === "PENDING"
                    ? "Partner application is still under review"
                    : access.status === "REJECTED"
                      ? "Partner application was rejected"
                      : "Approved partner access only. Open Partner app after admin approval."
            );
        }

        req.partner = {
            id: access.partner._id.toString(),
            partnerCode: access.partnerCode,
            status: access.status,
        };
        req.user.isApprovedPartner = true;

        next();
    } catch (error) {
        next(error);
    }
};
