const USER_STATUS = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    BLOCKED: "BLOCKED",
    SUSPENDED: "SUSPENDED",
};

/**
 * Fine-grained actions gated by user.status.
 * Keep route middleware + service checks in sync with this matrix.
 */
const ACTIONS = {
    LOGIN: "LOGIN",
    OTP_REQUEST: "OTP_REQUEST",

    PROFILE_READ: "PROFILE_READ",
    PROFILE_WRITE: "PROFILE_WRITE",

    KYC_READ: "KYC_READ",
    KYC_SUBMIT: "KYC_SUBMIT",

    WALLET_READ: "WALLET_READ",
    WALLET_WRITE: "WALLET_WRITE",

    REWARDS_READ: "REWARDS_READ",
    REWARDS_CLAIM: "REWARDS_CLAIM",

    REFERRAL_READ: "REFERRAL_READ",
    REFERRAL_EARN: "REFERRAL_EARN",

    NOTIFICATIONS_READ: "NOTIFICATIONS_READ",
    NOTIFICATIONS_WRITE: "NOTIFICATIONS_WRITE",

    PARTNER_APPLY: "PARTNER_APPLY",
    PARTNER_READ: "PARTNER_READ",
    PARTNER_WRITE: "PARTNER_WRITE",
};

const ALL_ACTIONS = Object.values(ACTIONS);

const NONE = [];

const SUSPENDED_ACTIONS = [
    ACTIONS.LOGIN,
    ACTIONS.OTP_REQUEST,
    ACTIONS.PROFILE_READ,
    ACTIONS.KYC_READ,
    ACTIONS.KYC_SUBMIT,
    ACTIONS.WALLET_READ,
    ACTIONS.REWARDS_READ,
    ACTIONS.REFERRAL_READ,
    ACTIONS.NOTIFICATIONS_READ,
    ACTIONS.NOTIFICATIONS_WRITE,
    ACTIONS.PARTNER_READ,
];

/** status → allowed actions */
const STATUS_ACTIONS = {
    [USER_STATUS.ACTIVE]: ALL_ACTIONS,
    [USER_STATUS.SUSPENDED]: SUSPENDED_ACTIONS,
    [USER_STATUS.INACTIVE]: NONE,
    [USER_STATUS.BLOCKED]: NONE,
};

const STATUS_MESSAGES = {
    [USER_STATUS.INACTIVE]:
        "Your account is inactive. Contact support to reactivate.",
    [USER_STATUS.BLOCKED]:
        "Your account has been blocked. Contact support for help.",
    [USER_STATUS.SUSPENDED]:
        "Your account is under review. Some actions are temporarily disabled.",
};

const canPerform = (status, action) => {
    const allowed = STATUS_ACTIONS[status] || NONE;
    return allowed.includes(action);
};

const getAllowedActions = (status) => [...(STATUS_ACTIONS[status] || NONE)];

const assertCanPerform = (status, action, ApiError) => {
    if (canPerform(status, action)) return;

    const message =
        STATUS_MESSAGES[status] ||
        "You are not allowed to perform this action";

    const err = new ApiError(403, message);
    err.accountStatus = status;
    err.action = action;
    err.allowedActions = getAllowedActions(status);
    throw err;
};

/** Login / OTP gate — only ACTIVE and SUSPENDED may authenticate. */
const canAuthenticate = (status) =>
    canPerform(status, ACTIONS.LOGIN);

/** Referrer must be ACTIVE to earn / validate referral codes. */
const canEarnReferral = (status) =>
    canPerform(status, ACTIONS.REFERRAL_EARN);

/** Map account status → wallet status when admin changes user.status */
const walletStatusForUserStatus = (userStatus) => {
    if (userStatus === USER_STATUS.ACTIVE) return "ACTIVE";
    if (userStatus === USER_STATUS.BLOCKED) return "BLOCKED";
    return "INACTIVE"; // INACTIVE | SUSPENDED
};

module.exports = {
    USER_STATUS,
    ACTIONS,
    ALL_ACTIONS,
    STATUS_ACTIONS,
    STATUS_MESSAGES,
    canPerform,
    getAllowedActions,
    assertCanPerform,
    canAuthenticate,
    canEarnReferral,
    walletStatusForUserStatus,
};
