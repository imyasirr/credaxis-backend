/**
 * Outbound bank payout adapter.
 * Plug RazorpayX / bank transfer API here later — UI + admin flow stay the same.
 */
exports.initiatePayout = async ({
    amount,
    currency = "INR",
    accountHolderName,
    accountNumber,
    ifscCode,
    bankName,
    referenceId,
}) => {
    // TODO: call real payout provider with bank details
    return {
        provider: "MANUAL",
        providerPayoutId: `MANUAL_${referenceId || Date.now()}`,
        providerStatus: "QUEUED",
        message:
            "Payout queued for manual/bank API processing. Connect provider in payout.client.js",
        meta: {
            amount,
            currency,
            accountHolderName,
            accountNumberMasked: maskAccount(accountNumber),
            ifscCode,
            bankName,
            queuedAt: new Date().toISOString(),
        },
    };
};

const maskAccount = (accountNumber = "") => {
    const value = String(accountNumber);
    if (value.length <= 4) return value;
    return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};
