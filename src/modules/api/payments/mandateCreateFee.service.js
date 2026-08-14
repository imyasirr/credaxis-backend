const Setting = require("../../admin/shared/setting.model");
const {
    SETTING_KEYS,
} = require("../../../integrations/razorpay/constants");
const creditCheckFeeService = require("./creditCheckFee.service");
const mandateInstallmentFeeService = require("./mandateInstallmentFee.service");
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
 * Combined create + installment fees for a mandate schedule.
 * ONCE → installment fee 0. Recurring → count × rate(frequency).
 */
exports.computeMandateSetupFees = async ({
    frequency = null,
    installmentCount = 0,
} = {}) => {
    const createFee = await exports.getMandateCreateFeeSetting();
    const installmentFee =
        await mandateInstallmentFeeService.computeInstallmentFee({
            frequency,
            installmentCount,
        });

    const createAmount = createFee.enabled ? Number(createFee.amount) || 0 : 0;
    const installmentTotal = Number(installmentFee.total) || 0;
    const grandTotal =
        Math.round((createAmount + installmentTotal) * 100) / 100;

    const coinConversion = createFee.coinConversion;
    const coinsRequired = creditCheckFeeService.computeCoinsRequired(
        grandTotal,
        coinConversion
    );

    return {
        currency: createFee.currency || "INR",
        createFee: {
            enabled: createFee.enabled,
            amount: createAmount,
        },
        installmentFee: {
            enabled: installmentFee.enabled,
            applicable: installmentFee.applicable,
            frequency: installmentFee.frequency,
            installmentCount: installmentFee.installmentCount,
            perInstallment: installmentFee.perInstallment,
            total: installmentTotal,
            byFrequency: installmentFee.byFrequency,
        },
        grandTotal,
        paymentRequired: grandTotal > 0,
        coinConversion,
        coinsRequired,
        conversionLabel: `${coinConversion.coins} coins = ₹${coinConversion.rupees}`,
    };
};

/**
 * Mobile quote: create fee + installment surcharge + methods.
 * Pass frequency + installment_count for accurate grandTotal.
 */
exports.getMandateCreateQuote = async (
    userId,
    { frequency = null, installmentCount = 0 } = {}
) => {
    const breakdown = await exports.computeMandateSetupFees({
        frequency,
        installmentCount,
    });

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

    const amount = breakdown.grandTotal;
    const payDue = breakdown.paymentRequired;
    const onlineOk = payDue;
    const walletOk = payDue && walletBalance >= amount;
    const coinsOk = payDue && coinBalance >= breakdown.coinsRequired;

    /** Mobile-friendly line items for checkout UI */
    const charges = [];
    if (breakdown.createFee.amount > 0) {
        charges.push({
            key: "CREATE",
            label: "Mandate create fee",
            amount: breakdown.createFee.amount,
            currency: breakdown.currency,
        });
    }
    if (breakdown.installmentFee.total > 0) {
        const n = breakdown.installmentFee.installmentCount || 0;
        const per = breakdown.installmentFee.perInstallment || 0;
        charges.push({
            key: "INSTALLMENT",
            label:
                n > 1
                    ? `Installment fee (${n} × ₹${per})`
                    : "Installment fee",
            amount: breakdown.installmentFee.total,
            currency: breakdown.currency,
            perInstallment: per,
            installmentCount: n,
            frequency: breakdown.installmentFee.frequency,
        });
    }

    return {
        amount,
        currency: breakdown.currency,
        enabled:
            breakdown.createFee.enabled || breakdown.installmentFee.enabled,
        paymentRequired: breakdown.paymentRequired,
        /** Checkout rows — show these in app before pay */
        charges,
        createFee: breakdown.createFee,
        installmentFee: breakdown.installmentFee,
        grandTotal: breakdown.grandTotal,
        coinConversion: breakdown.coinConversion,
        coinsRequired: breakdown.coinsRequired,
        conversionLabel: breakdown.conversionLabel,
        walletBalance,
        coinBalance,
        paymentMethods: [
            {
                method: MANDATE_CREATE_METHODS.ONLINE,
                label: "Pay online",
                enabled: onlineOk,
                amount,
                currency: breakdown.currency,
                canPay: onlineOk,
            },
            {
                method: MANDATE_CREATE_METHODS.WALLET,
                label: "Pay from wallet",
                enabled: onlineOk,
                amount,
                currency: breakdown.currency,
                walletBalance,
                canPay: walletOk,
                reason: walletOk
                    ? null
                    : !payDue
                      ? "No mandate fee due for this schedule"
                      : "Insufficient wallet balance",
            },
            {
                method: MANDATE_CREATE_METHODS.COINS,
                label: "Pay with coins",
                enabled: onlineOk,
                coinsRequired: breakdown.coinsRequired,
                coinBalance,
                conversionLabel: breakdown.conversionLabel,
                amountEquivalent: amount,
                currency: breakdown.currency,
                canPay: coinsOk,
                reason: coinsOk
                    ? null
                    : !payDue
                      ? "No mandate fee due for this schedule"
                      : "Insufficient coin balance",
            },
        ],
    };
};
