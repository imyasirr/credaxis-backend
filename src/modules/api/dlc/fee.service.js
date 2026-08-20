const Setting = require("../../admin/shared/setting.model");
const ApiError = require("../../../utils/ApiError");
const { SETTING_KEY, DEFAULT_DLC_CREATE_FEE } = require("./constants");

const formatFee = (value = {}) => {
    const amount =
        Number(value.amount) > 0
            ? Number(value.amount)
            : DEFAULT_DLC_CREATE_FEE.amount;

    return {
        amount,
        currency: value.currency || "INR",
        enabled: value.enabled !== false,
        method: "WALLET",
        paymentRequired:
            value.enabled !== false && amount > 0,
    };
};

exports.getDlcCreateFeeSetting = async () => {
    let doc = await Setting.findOne({ key: SETTING_KEY });

    if (!doc) {
        doc = await Setting.create({
            key: SETTING_KEY,
            value: DEFAULT_DLC_CREATE_FEE,
            description:
                "DLC Superkey create fee (INR). Charged from user wallet once per device register.",
        });
    }

    return formatFee(doc.value);
};

exports.updateDlcCreateFeeSetting = async (body = {}) => {
    const current = await exports.getDlcCreateFeeSetting();

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
        throw new ApiError(400, "DLC create fee must be at least ₹1");
    }

    await Setting.findOneAndUpdate(
        { key: SETTING_KEY },
        {
            $set: {
                value: next,
                description:
                    "DLC Superkey create fee (INR). Charged from user wallet once per device register.",
            },
        },
        { upsert: true, new: true }
    );

    return exports.getDlcCreateFeeSetting();
};
