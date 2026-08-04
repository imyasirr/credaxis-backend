const Setting = require("../../admin/shared/setting.model");
const {
    SETTING_KEYS,
} = require("../../../integrations/razorpay/constants");
const ApiError = require("../../../utils/ApiError");

const DEFAULT_CREDIT_CHECK_FEE = {
    amount: 49,
    currency: "INR",
    enabled: true,
};

const formatFee = (value = {}) => ({
    amount: Number(value.amount) > 0 ? Number(value.amount) : DEFAULT_CREDIT_CHECK_FEE.amount,
    currency: value.currency || "INR",
    enabled: value.enabled !== false,
});

exports.getCreditCheckFeeSetting = async () => {
    let doc = await Setting.findOne({ key: SETTING_KEYS.CREDIT_CHECK_FEE });

    if (!doc) {
        doc = await Setting.create({
            key: SETTING_KEYS.CREDIT_CHECK_FEE,
            value: DEFAULT_CREDIT_CHECK_FEE,
            description: "Fee charged via Razorpay for user credit report fetch",
        });
    }

    return formatFee(doc.value);
};

exports.updateCreditCheckFeeSetting = async (body = {}) => {
    const current = await exports.getCreditCheckFeeSetting();
    const next = {
        amount:
            body.amount !== undefined
                ? Number(body.amount)
                : current.amount,
        currency: body.currency || current.currency || "INR",
        enabled:
            body.enabled !== undefined
                ? Boolean(body.enabled)
                : current.enabled,
    };

    if (!next.amount || next.amount < 1) {
        throw new ApiError(400, "Credit check fee must be at least ₹1");
    }

    const doc = await Setting.findOneAndUpdate(
        { key: SETTING_KEYS.CREDIT_CHECK_FEE },
        {
            $set: {
                value: next,
                description:
                    "Fee charged via Razorpay for user credit report fetch",
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
