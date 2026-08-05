const Setting = require("../../admin/shared/setting.model");
const {
    SETTING_KEYS,
} = require("../../../integrations/razorpay/constants");
const ApiError = require("../../../utils/ApiError");

const DEFAULT_CREDIT_CHECK_FEE = {
    amount: 50,
    currency: "INR",
    enabled: true,
    /** 100 coins = ₹5 → ₹50 fee = 1000 coins */
    coinConversion: {
        coins: 100,
        rupees: 5,
    },
};

const CREDIT_CHECK_METHODS = Object.freeze({
    ONLINE: "ONLINE",
    WALLET: "WALLET",
    COINS: "COINS",
});

const normalizeCoinConversion = (value = {}) => {
    const coins = Number(value.coins);
    const rupees = Number(value.rupees);
    return {
        coins: coins > 0 ? coins : DEFAULT_CREDIT_CHECK_FEE.coinConversion.coins,
        rupees:
            rupees > 0 ? rupees : DEFAULT_CREDIT_CHECK_FEE.coinConversion.rupees,
    };
};

/** Coins needed to cover `amountInr` at conversion rate. */
const computeCoinsRequired = (amountInr, coinConversion) => {
    const { coins, rupees } = normalizeCoinConversion(coinConversion);
    const amount = Number(amountInr) || 0;
    if (amount <= 0 || rupees <= 0) return 0;
    return Math.ceil((amount * coins) / rupees);
};

const formatFee = (value = {}) => {
    const amount =
        Number(value.amount) > 0
            ? Number(value.amount)
            : DEFAULT_CREDIT_CHECK_FEE.amount;
    const coinConversion = normalizeCoinConversion(value.coinConversion);
    const coinsRequired = computeCoinsRequired(amount, coinConversion);

    return {
        amount,
        currency: value.currency || "INR",
        enabled: value.enabled !== false,
        coinConversion,
        coinsRequired,
        conversionLabel: `${coinConversion.coins} coins = ₹${coinConversion.rupees}`,
    };
};

exports.CREDIT_CHECK_METHODS = CREDIT_CHECK_METHODS;
exports.computeCoinsRequired = computeCoinsRequired;

exports.getCreditCheckFeeSetting = async () => {
    let doc = await Setting.findOne({ key: SETTING_KEYS.CREDIT_CHECK_FEE });

    if (!doc) {
        doc = await Setting.create({
            key: SETTING_KEYS.CREDIT_CHECK_FEE,
            value: DEFAULT_CREDIT_CHECK_FEE,
            description:
                "Credit check fee + coin conversion (Online / Wallet / Coins)",
        });
    }

    return formatFee(doc.value);
};

exports.updateCreditCheckFeeSetting = async (body = {}) => {
    const current = await exports.getCreditCheckFeeSetting();

    const nextConversion = normalizeCoinConversion({
        coins:
            body.coinConversion?.coins !== undefined
                ? body.coinConversion.coins
                : body.coins !== undefined
                  ? body.coins
                  : current.coinConversion.coins,
        rupees:
            body.coinConversion?.rupees !== undefined
                ? body.coinConversion.rupees
                : body.rupees !== undefined
                  ? body.rupees
                  : current.coinConversion.rupees,
    });

    const next = {
        amount:
            body.amount !== undefined ? Number(body.amount) : current.amount,
        currency: body.currency || current.currency || "INR",
        enabled:
            body.enabled !== undefined
                ? Boolean(body.enabled)
                : current.enabled,
        coinConversion: nextConversion,
    };

    if (!next.amount || next.amount < 1) {
        throw new ApiError(400, "Credit check fee must be at least ₹1");
    }
    if (!next.coinConversion.coins || next.coinConversion.coins < 1) {
        throw new ApiError(400, "Coin conversion: coins must be at least 1");
    }
    if (!next.coinConversion.rupees || next.coinConversion.rupees <= 0) {
        throw new ApiError(400, "Coin conversion: rupees must be greater than 0");
    }

    const doc = await Setting.findOneAndUpdate(
        { key: SETTING_KEYS.CREDIT_CHECK_FEE },
        {
            $set: {
                value: next,
                description:
                    "Credit check fee + coin conversion (Online / Wallet / Coins)",
            },
        },
        { upsert: true, new: true }
    );

    return formatFee(doc.value);
};

/** Amount for creating a CREDIT_CHECK payment. Throws if disabled. */
exports.resolveCreditCheckAmount = async () => {
    const fee = await exports.getCreditCheckFeeSetting();

    if (!fee.enabled) {
        throw new ApiError(400, "Credit check payments are currently disabled");
    }

    return fee.amount;
};

/**
 * Mobile quote: fee + conversion + user wallet/coin balances + canPay flags.
 */
exports.getCreditCheckQuote = async (userId) => {
    const fee = await exports.getCreditCheckFeeSetting();

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
                method: CREDIT_CHECK_METHODS.ONLINE,
                label: "Pay online",
                enabled: onlineOk,
                amount: fee.amount,
                currency: fee.currency,
                canPay: onlineOk,
            },
            {
                method: CREDIT_CHECK_METHODS.WALLET,
                label: "Pay from wallet",
                enabled: onlineOk,
                amount: fee.amount,
                currency: fee.currency,
                walletBalance,
                canPay: walletOk,
                reason: walletOk
                    ? null
                    : !fee.enabled
                      ? "Credit check payments disabled"
                      : "Insufficient wallet balance",
            },
            {
                method: CREDIT_CHECK_METHODS.COINS,
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
                      ? "Credit check payments disabled"
                      : "Insufficient coin balance",
            },
        ],
    };
};
