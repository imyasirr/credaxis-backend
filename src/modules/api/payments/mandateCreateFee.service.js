const Setting = require("../../admin/shared/setting.model");
const {
    SETTING_KEYS,
} = require("../../../integrations/razorpay/constants");
const creditCheckFeeService = require("./creditCheckFee.service");
const ApiError = require("../../../utils/ApiError");

const DEFAULT_MANDATE_CREATE_FEE = {
    amount: 15,
    currency: "INR",
    enabled: true,
};

const MANDATE_CREATE_METHODS = Object.freeze({
    ONLINE: "ONLINE",
    WALLET: "WALLET",
    COINS: "COINS",
});

/**
 * Coins always auto-calc from fee amount × shared coin rate
 * (Settings → Coin conversion: e.g. 100 coins = ₹5 → ₹15 = 300, ₹30 = 600).
 */
const formatFee = (value = {}, coinConversion) => {
    const amount =
        Number(value.amount) > 0
            ? Number(value.amount)
            : DEFAULT_MANDATE_CREATE_FEE.amount;
    const coinsRequired = creditCheckFeeService.computeCoinsRequired(
        amount,
        coinConversion
    );

    return {
        amount,
        currency: value.currency || "INR",
        enabled: value.enabled !== false,
        coinConversion: {
            coins: coinConversion.coins,
            rupees: coinConversion.rupees,
        },
        coinsRequired,
        conversionLabel: `${coinConversion.coins} coins = ₹${coinConversion.rupees}`,
    };
};

const getSharedCoinConversion = async () => {
    const creditFee = await creditCheckFeeService.getCreditCheckFeeSetting();
    return creditFee.coinConversion;
};

exports.MANDATE_CREATE_METHODS = MANDATE_CREATE_METHODS;

exports.getMandateCreateFeeSetting = async () => {
    let doc = await Setting.findOne({ key: SETTING_KEYS.MANDATE_CREATE_FEE });

    if (!doc) {
        doc = await Setting.create({
            key: SETTING_KEYS.MANDATE_CREATE_FEE,
            value: DEFAULT_MANDATE_CREATE_FEE,
            description:
                "Mandate create fee (INR). Coins auto-calculated from shared coin conversion rate.",
        });
    }

    const coinConversion = await getSharedCoinConversion();
    return formatFee(doc.value, coinConversion);
};

exports.updateMandateCreateFeeSetting = async (body = {}) => {
    const current = await exports.getMandateCreateFeeSetting();

    const next = {
        amount:
            body.amount !== undefined ? Number(body.amount) : current.amount,
        currency: body.currency || current.currency || "INR",
        enabled:
            body.enabled !== undefined
                ? Boolean(body.enabled)
                : current.enabled,
    };

    if (!next.amount || next.amount < 1) {
        throw new ApiError(400, "Mandate create fee must be at least ₹1");
    }

    await Setting.findOneAndUpdate(
        { key: SETTING_KEYS.MANDATE_CREATE_FEE },
        {
            $set: {
                value: next,
                description:
                    "Mandate create fee (INR). Coins auto-calculated from shared coin conversion rate.",
            },
        },
        { upsert: true, new: true }
    );

    // Return with fresh auto-calculated coinsRequired
    return exports.getMandateCreateFeeSetting();
};

/** Amount for creating a MANDATE_CREATE payment. Throws if disabled. */
exports.resolveMandateCreateAmount = async () => {
    const fee = await exports.getMandateCreateFeeSetting();

    if (!fee.enabled) {
        throw new ApiError(
            400,
            "Mandate create payments are currently disabled"
        );
    }

    return fee.amount;
};

/**
 * Mobile quote: fee + auto coinsRequired + wallet/coin balances + canPay.
 */
exports.getMandateCreateQuote = async (userId) => {
    const fee = await exports.getMandateCreateFeeSetting();

    let walletBalance = 0;
    let coinBalance = 0;

    try {
        const walletService = require("../wallet/service");
        const wallet = await walletService.getMyWallet(userId);
        walletBalance = Number(wallet?.availableBalance) || 0;
    } catch {
        walletBalance = 0;
    }

    try {
        const coinService = require("../coins/service");
        const coins = await coinService.getMyCoins(userId);
        coinBalance = Number(coins?.availableBalance) || 0;
    } catch {
        coinBalance = 0;
    }

    const onlineOk = fee.enabled;
    const walletOk = fee.enabled && walletBalance >= fee.amount;
    const coinsOk = fee.enabled && coinBalance >= fee.coinsRequired;

    return {
        amount: fee.amount,
        currency: fee.currency,
        enabled: fee.enabled,
        coinConversion: fee.coinConversion,
        coinsRequired: fee.coinsRequired,
        conversionLabel: fee.conversionLabel,
        walletBalance,
        coinBalance,
        paymentMethods: [
            {
                method: MANDATE_CREATE_METHODS.ONLINE,
                label: "Pay online",
                enabled: onlineOk,
                amount: fee.amount,
                currency: fee.currency,
                canPay: onlineOk,
            },
            {
                method: MANDATE_CREATE_METHODS.WALLET,
                label: "Pay from wallet",
                enabled: onlineOk,
                amount: fee.amount,
                currency: fee.currency,
                walletBalance,
                canPay: walletOk,
                reason: walletOk
                    ? null
                    : !fee.enabled
                      ? "Mandate create payments disabled"
                      : "Insufficient wallet balance",
            },
            {
                method: MANDATE_CREATE_METHODS.COINS,
                label: "Pay with coins",
                enabled: onlineOk,
                coinsRequired: fee.coinsRequired,
                coinBalance,
                conversionLabel: fee.conversionLabel,
                amountEquivalent: fee.amount,
                currency: fee.currency,
                canPay: coinsOk,
                reason: coinsOk
                    ? null
                    : !fee.enabled
                      ? "Mandate create payments disabled"
                      : "Insufficient coin balance",
            },
        ],
    };
};
