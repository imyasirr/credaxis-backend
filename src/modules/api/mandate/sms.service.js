const Mandate = require("./mandate.model");
const Installment = require("./installment.model");
const User = require("../user/model");
const fast2sms = require("../../../integrations/fast2sms/fast2sms.client");

const COLLECTION_OR_LATER = new Set([
    "COLLECTION_SUCCESS",
    "SETTLEMENT_INITIATED",
    "SETTLEMENT_SUCCESS",
]);

const env = (key) => String(process.env[key] || "").trim();

const isEnabled = () => env("MANDATE_SMS_ENABLED") !== "false";

const to10Digit = (mobile) => {
    const digits = String(mobile || "").replace(/\D/g, "");
    return digits.slice(-10);
};

const isValidMobile = (mobile) => /^[6-9]\d{9}$/.test(to10Digit(mobile));

const dltVar = (value, fallback = "") =>
    String(value ?? fallback)
        .replace(/[|]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 30) || fallback;

const formatAmount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return "0";
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const merchantDisplayName = (mandate) =>
    dltVar(
        mandate?.distributor?.businessName || mandate?.distributor?.name,
        "CredAxis"
    );

const customerDisplayName = (mandate, installment) =>
    dltVar(
        mandate?.customerName ||
            installment?.payer?.account?.name,
        "customer"
    );

const customerMobileOf = (mandate, installment) =>
    mandate?.customerMobile ||
    installment?.payer?.account?.mobile_number ||
    null;

const merchantMobileOf = async (mandate) => {
    const fromDistributor = mandate?.distributor?.mobile;
    if (isValidMobile(fromDistributor)) return fromDistributor;
    if (!mandate?.user) return null;
    const user = await User.findById(mandate.user).select("mobile");
    return user?.mobile || null;
};

const sendOne = async ({ mobile, messageId, amount, name, label }) => {
    if (!messageId) {
        console.warn(`[MandateSMS] skip ${label}: DLT template id empty`);
        return false;
    }
    if (!isValidMobile(mobile)) {
        console.warn(`[MandateSMS] skip ${label}: invalid mobile`);
        return false;
    }
    await fast2sms.sendDltSms({
        mobile: to10Digit(mobile),
        messageId,
        variablesValues: `${formatAmount(amount)}|${dltVar(name, "CredAxis")}`,
    });
    return true;
};

const claim = async (Model, id, field) => {
    const claimed = await Model.findOneAndUpdate(
        {
            _id: id,
            $or: [{ [field]: { $exists: false } }, { [field]: null }],
        },
        { $set: { [field]: new Date() } },
        { new: true }
    );
    return Boolean(claimed);
};

const unclaim = async (Model, id, field) => {
    await Model.updateOne({ _id: id }, { $set: { [field]: null } });
};

const sendPair = async ({
    Model,
    id,
    field,
    amount,
    customerMobile,
    customerName,
    merchantMobile,
    merchantName,
    customerTemplateEnv,
    merchantTemplateEnv,
    label,
}) => {
    if (!isEnabled()) return;

    const customerId = env(customerTemplateEnv);
    const merchantId = env(merchantTemplateEnv);
    if (!customerId && !merchantId) return;

    const locked = await claim(Model, id, field);
    if (!locked) return;

    let anySent = false;

    const trySend = async (opts) => {
        try {
            const ok = await sendOne(opts);
            if (ok) anySent = true;
        } catch (err) {
            console.error(`[MandateSMS] ${opts.label} failed:`, err.message);
        }
    };

    await trySend({
        mobile: customerMobile,
        messageId: customerId,
        amount,
        name: merchantName,
        label: `${label} customer`,
    });
    await trySend({
        mobile: merchantMobile,
        messageId: merchantId,
        amount,
        name: customerName,
        label: `${label} merchant`,
    });

    // Nothing delivered — allow a later sync to retry (e.g. mobile filled later)
    if (!anySent) {
        await unclaim(Model, id, field);
    }
};

const notifyActivated = async (mandate) => {
    if (!mandate?._id || mandate.state !== "ACTIVATED") return;

    await sendPair({
        Model: Mandate,
        id: mandate._id,
        field: "sms.activatedSentAt",
        amount: mandate.approvalAmount,
        customerMobile: customerMobileOf(mandate),
        customerName: customerDisplayName(mandate),
        merchantMobile: await merchantMobileOf(mandate),
        merchantName: merchantDisplayName(mandate),
        customerTemplateEnv: "FAST2SMS_DLT_MANDATE_ACTIVE_CUSTOMER",
        merchantTemplateEnv: "FAST2SMS_DLT_MANDATE_ACTIVE_MERCHANT",
        label: "ACTIVATED",
    });
};

const notifyCollection = async (installment, mandate) => {
    if (!installment?._id || !COLLECTION_OR_LATER.has(installment.state)) {
        return;
    }

    await sendPair({
        Model: Installment,
        id: installment._id,
        field: "sms.collectionSentAt",
        amount: installment.amount,
        customerMobile: customerMobileOf(mandate, installment),
        customerName: customerDisplayName(mandate, installment),
        merchantMobile: await merchantMobileOf(mandate),
        merchantName: merchantDisplayName(mandate),
        customerTemplateEnv: "FAST2SMS_DLT_COLLECTION_CUSTOMER",
        merchantTemplateEnv: "FAST2SMS_DLT_COLLECTION_MERCHANT",
        label: "COLLECTION",
    });
};

const notifySettlement = async (installment, mandate) => {
    if (!installment?._id || installment.state !== "SETTLEMENT_SUCCESS") {
        return;
    }

    await sendPair({
        Model: Installment,
        id: installment._id,
        field: "sms.settlementSentAt",
        amount: installment.amount,
        customerMobile: customerMobileOf(mandate, installment),
        customerName: customerDisplayName(mandate, installment),
        merchantMobile: await merchantMobileOf(mandate),
        merchantName: merchantDisplayName(mandate),
        customerTemplateEnv: "FAST2SMS_DLT_SETTLEMENT_CUSTOMER",
        merchantTemplateEnv: "FAST2SMS_DLT_SETTLEMENT_MERCHANT",
        label: "SETTLEMENT",
    });
};

/**
 * Fire-and-forget so webhook / refresh never fail because of SMS.
 */
const runSafe = (label, fn) => {
    Promise.resolve()
        .then(fn)
        .catch((err) => console.error(`[MandateSMS] ${label}:`, err.message));
};

exports.afterMandateSync = (mandate) => {
    runSafe("activated", () => notifyActivated(mandate));
};

exports.afterInstallmentSync = (installment, mandate) => {
    runSafe("collection", () => notifyCollection(installment, mandate));
    runSafe("settlement", () => notifySettlement(installment, mandate));
};
