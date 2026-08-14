const Setting = require("../../admin/shared/setting.model");
const {
    SETTING_KEYS,
} = require("../../../integrations/razorpay/constants");
const creditCheckFeeService = require("./creditCheckFee.service");
const ApiError = require("../../../utils/ApiError");

/** Defaults: DAILY ₹10; WEEKLY/MONTHLY/YEARLY ₹15; ONCE ₹0; ADHOC off */
const DEFAULT_MANDATE_INSTALLMENT_FEE = {
    enabled: true,
    currency: "INR",
    daily: 10,
    weekly: 15,
    monthly: 15,
    yearly: 15,
    /** Optional fee when app creates an ADHOC installment */
    adhocEnabled: false,
    adhoc: 15,
};

const RECURRING_FREQUENCIES = new Set([
    "DAILY",
    "WEEKLY",
    "MONTHLY",
    "YEARLY",
]);

const normalizeFrequency = (raw) =>
    String(raw || "")
        .trim()
        .toUpperCase();

const positiveAmount = (value, fallback) => {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
    return fallback;
};

const formatSetting = (value = {}) => ({
    enabled: value.enabled !== false,
    currency: value.currency || "INR",
    daily: positiveAmount(value.daily, DEFAULT_MANDATE_INSTALLMENT_FEE.daily),
    weekly: positiveAmount(
        value.weekly,
        DEFAULT_MANDATE_INSTALLMENT_FEE.weekly
    ),
    monthly: positiveAmount(
        value.monthly,
        DEFAULT_MANDATE_INSTALLMENT_FEE.monthly
    ),
    yearly: positiveAmount(
        value.yearly,
        DEFAULT_MANDATE_INSTALLMENT_FEE.yearly
    ),
    adhocEnabled: Boolean(value.adhocEnabled),
    adhoc: positiveAmount(value.adhoc, DEFAULT_MANDATE_INSTALLMENT_FEE.adhoc),
});

exports.RECURRING_FREQUENCIES = RECURRING_FREQUENCIES;

exports.getMandateInstallmentFeeSetting = async () => {
    let doc = await Setting.findOne({
        key: SETTING_KEYS.MANDATE_INSTALLMENT_FEE,
    });

    if (!doc) {
        doc = await Setting.create({
            key: SETTING_KEYS.MANDATE_INSTALLMENT_FEE,
            value: DEFAULT_MANDATE_INSTALLMENT_FEE,
            description:
                "Per-installment CredAxis fee by mandate frequency (ONCE excluded). Charged at mandate create = count × rate.",
        });
    }

    return formatSetting(doc.value);
};

exports.updateMandateInstallmentFeeSetting = async (body = {}) => {
    const current = await exports.getMandateInstallmentFeeSetting();

    const next = {
        enabled:
            body.enabled !== undefined
                ? Boolean(body.enabled)
                : current.enabled,
        currency: body.currency || current.currency || "INR",
        daily:
            body.daily !== undefined
                ? positiveAmount(body.daily, current.daily)
                : current.daily,
        weekly:
            body.weekly !== undefined
                ? positiveAmount(body.weekly, current.weekly)
                : current.weekly,
        monthly:
            body.monthly !== undefined
                ? positiveAmount(body.monthly, current.monthly)
                : current.monthly,
        yearly:
            body.yearly !== undefined
                ? positiveAmount(body.yearly, current.yearly)
                : current.yearly,
        adhocEnabled:
            body.adhocEnabled !== undefined
                ? Boolean(body.adhocEnabled)
                : current.adhocEnabled,
        adhoc:
            body.adhoc !== undefined
                ? positiveAmount(body.adhoc, current.adhoc)
                : current.adhoc,
    };

    for (const key of ["daily", "weekly", "monthly", "yearly", "adhoc"]) {
        if (next[key] < 0) {
            throw new ApiError(400, `${key} fee cannot be negative`);
        }
    }

    await Setting.findOneAndUpdate(
        { key: SETTING_KEYS.MANDATE_INSTALLMENT_FEE },
        {
            $set: {
                value: next,
                description:
                    "Per-installment CredAxis fee by mandate frequency (ONCE excluded). Charged at mandate create = count × rate.",
            },
        },
        { upsert: true, new: true }
    );

    return exports.getMandateInstallmentFeeSetting();
};

/**
 * Per-installment rate for a frequency. ONCE → 0. ADHOC uses adhoc* when enabled.
 */
exports.getPerInstallmentRate = (setting, frequency) => {
    const freq = normalizeFrequency(frequency);
    if (!setting?.enabled) return 0;

    if (freq === "ONCE" || !freq) return 0;

    if (freq === "ADHOC") {
        return setting.adhocEnabled ? Number(setting.adhoc) || 0 : 0;
    }

    if (freq === "DAILY") return Number(setting.daily) || 0;
    if (freq === "WEEKLY") return Number(setting.weekly) || 0;
    if (freq === "MONTHLY") return Number(setting.monthly) || 0;
    if (freq === "YEARLY") return Number(setting.yearly) || 0;

    return 0;
};

/**
 * Create-time installment surcharge: installment_count × rate(frequency).
 * ONCE → total 0. Missing count for recurring → treat count as 1 if rate > 0.
 */
exports.computeInstallmentFee = async ({
    frequency,
    installmentCount,
} = {}) => {
    const setting = await exports.getMandateInstallmentFeeSetting();
    const freq = normalizeFrequency(frequency);
    const perInstallment = exports.getPerInstallmentRate(setting, freq);

    let count = Number(installmentCount);
    if (!Number.isFinite(count) || count < 0) count = 0;

    if (perInstallment > 0 && count < 1 && RECURRING_FREQUENCIES.has(freq)) {
        count = 1;
    }

    const total =
        setting.enabled && perInstallment > 0 && count > 0
            ? Math.round(perInstallment * count * 100) / 100
            : 0;

    return {
        enabled: setting.enabled,
        applicable: total > 0,
        frequency: freq || null,
        installmentCount: count,
        perInstallment,
        total,
        currency: setting.currency || "INR",
        byFrequency: {
            daily: setting.daily,
            weekly: setting.weekly,
            monthly: setting.monthly,
            yearly: setting.yearly,
            adhoc: setting.adhoc,
            adhocEnabled: setting.adhocEnabled,
        },
    };
};

/**
 * Fee for a single ADHOC installment create (optional setting).
 */
exports.computeAdhocInstallmentCreateFee = async () => {
    const setting = await exports.getMandateInstallmentFeeSetting();
    const amount =
        setting.enabled && setting.adhocEnabled
            ? Number(setting.adhoc) || 0
            : 0;

    const coinConversion = (
        await creditCheckFeeService.getCreditCheckFeeSetting()
    ).coinConversion;
    const coinsRequired = creditCheckFeeService.computeCoinsRequired(
        amount,
        coinConversion
    );

    return {
        enabled: setting.enabled && setting.adhocEnabled,
        amount,
        currency: setting.currency || "INR",
        coinsRequired,
        coinConversion,
        conversionLabel: `${coinConversion.coins} coins = ₹${coinConversion.rupees}`,
    };
};
