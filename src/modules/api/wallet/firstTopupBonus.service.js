const Setting = require("../../admin/shared/setting.model");
const ApiError = require("../../../utils/ApiError");

const SETTING_KEY = "FIRST_TOPUP_BONUS";

const DEFAULTS = {
    /** Minimum top-up (INR) to earn equal coins on first eligible top-up */
    minAmount: 100,
    enabled: true,
};

const formatSetting = (value = {}) => ({
    minAmount:
        Number(value.minAmount) > 0
            ? Number(value.minAmount)
            : DEFAULTS.minAmount,
    enabled: value.enabled !== false,
});

exports.getFirstTopupBonusSetting = async () => {
    let doc = await Setting.findOne({ key: SETTING_KEY });

    if (!doc) {
        doc = await Setting.create({
            key: SETTING_KEY,
            value: DEFAULTS,
            description:
                "First wallet top-up coin bonus: if amount ≥ minAmount, grant equal coins once",
        });
    }

    return formatSetting(doc.value);
};

exports.updateFirstTopupBonusSetting = async (body = {}) => {
    const current = await exports.getFirstTopupBonusSetting();
    const next = {
        minAmount:
            body.minAmount !== undefined
                ? Number(body.minAmount)
                : current.minAmount,
        enabled:
            body.enabled !== undefined
                ? Boolean(body.enabled)
                : current.enabled,
    };

    if (!next.minAmount || next.minAmount < 1) {
        throw new ApiError(400, "Minimum amount must be at least ₹1");
    }

    const doc = await Setting.findOneAndUpdate(
        { key: SETTING_KEY },
        {
            $set: {
                value: next,
                description:
                    "First wallet top-up coin bonus: if amount ≥ minAmount, grant equal coins once",
            },
        },
        { upsert: true, new: true }
    );

    return formatSetting(doc.value);
};

exports.SETTING_KEY = SETTING_KEY;
exports.DEFAULTS = DEFAULTS;
