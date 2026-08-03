const partnerRepository = require("./repository");

const PARTNER_APP_URL = () =>
    process.env.PARTNER_APP_URL ||
    process.env.PARTNER_APP_LINK ||
    null;

/**
 * Partner access is based on Partner application status — not User.role.
 * Approved partners keep role USER so the user app stays available.
 */
exports.getPartnerAccess = async (userId) => {
    if (!userId) {
        return {
            partner: null,
            status: null,
            isApproved: false,
            partnerCode: null,
            canUsePartnerApp: false,
        };
    }

    const partner = await partnerRepository.findByUserId(userId);
    const status = partner?.status || null;
    const isApproved = status === "APPROVED";

    return {
        partner: partner || null,
        status,
        isApproved,
        partnerCode: isApproved ? partner.partnerCode || null : null,
        canUsePartnerApp: isApproved,
    };
};

exports.formatPartnerAccount = (access) => {
    const status = access?.status || null;
    const isApproved = Boolean(access?.isApproved);
    const partnerAppUrl = PARTNER_APP_URL();

    let message = "You have not applied as a partner yet";
    let nextAction = "apply";

    if (status === "PENDING") {
        message = "Your partner application is under review";
        nextAction = "wait_for_approval";
    } else if (status === "REJECTED") {
        message =
            access?.partner?.remarks ||
            "Your partner application was rejected. You can re-apply";
        nextAction = "reapply";
    } else if (isApproved) {
        message =
            "Your partner account is approved. Open the Partner app to continue";
        nextAction = "open_partner_app";
    }

    return {
        status,
        isApproved,
        partnerCode: access?.partnerCode || null,
        partnerAppUrl: isApproved ? partnerAppUrl : null,
        message,
        nextAction,
    };
};
