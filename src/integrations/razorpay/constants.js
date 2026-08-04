const PAYMENT_PURPOSES = Object.freeze({
    WALLET_TOPUP: "WALLET_TOPUP",
    CREDIT_CHECK: "CREDIT_CHECK",
});

const PAYMENT_STATUSES = Object.freeze({
    CREATED: "CREATED",
    PAID: "PAID",
    FAILED: "FAILED",
    CONSUMED: "CONSUMED",
});

const SETTING_KEYS = Object.freeze({
    CREDIT_CHECK_FEE: "CREDIT_CHECK_FEE",
});

module.exports = {
    PAYMENT_PURPOSES,
    PAYMENT_STATUSES,
    SETTING_KEYS,
};
