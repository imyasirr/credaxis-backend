const crypto = require("crypto");
const mongoose = require("mongoose");
const Mandate = require("./mandate.model");
const Installment = require("./installment.model");
const BankAccount = require("../wallet/bankAccount.model");
const gateway = require("./rocketpay.gateway");
const { formatMandate, formatInstallment } = require("./mapper");
const ApiError = require("../../../utils/ApiError");

const generateMandateReference = (userId = null) => {
    const prefix = "MAND";
    const userPart = userId ? String(userId).slice(-6) : "USER";
    const stamp = Date.now().toString(36).toUpperCase();
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${prefix}_${userPart}_${stamp}_${randomPart}`;
};

const isObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value) &&
    String(new mongoose.Types.ObjectId(value)) === String(value);

const toRocketPayAccountType = (accountType) => {
    const value = String(accountType || "SAVINGS").trim().toUpperCase();
    return value === "SAVING" ? "SAVINGS" : value;
};

const buildBankInstrument = (bankAccount) => ({
    type: "BANK_ACCOUNT",
    account_number: bankAccount.accountNumber,
    ifsc: bankAccount.ifscCode,
    account_holder_name: bankAccount.accountHolderName,
    account_type: toRocketPayAccountType(bankAccount.accountType),
});

const attachCustomerInstrument = async (userId, body) => {
    if (body.customer?.instrument) {
        return;
    }

    const bankAccount = await BankAccount.findOne({
        user: userId,
        status: "ACTIVE",
        isPrimary: true,
    }).sort({ createdAt: -1 });

    if (!bankAccount) {
        throw new ApiError(
            400,
            "Primary bank account not found. Add a primary bank account before creating mandate"
        );
    }

    body.customer = body.customer || {};
    body.customer.instrument = buildBankInstrument(bankAccount);
};

exports.resolveMandate = async (idOrRpId, { userId = null } = {}) => {
    const filter = isObjectId(idOrRpId)
        ? { $or: [{ _id: idOrRpId }, { rocketpayId: String(idOrRpId) }] }
        : { rocketpayId: String(idOrRpId) };

    if (userId) {
        filter.user = userId;
    }

    const doc = await Mandate.findOne(filter);
    if (!doc) {
        throw new ApiError(404, "Mandate not found");
    }
    return doc;
};

exports.resolveInstallment = async (idOrRpId, { userId = null } = {}) => {
    const filter = isObjectId(idOrRpId)
        ? { $or: [{ _id: idOrRpId }, { rocketpayId: String(idOrRpId) }] }
        : { rocketpayId: String(idOrRpId) };

    if (userId) {
        filter.user = userId;
    }

    const doc = await Installment.findOne(filter);
    if (!doc) {
        throw new ApiError(404, "Installment not found");
    }
    return doc;
};

exports.createMandate = async (userId, body, ipAddress) => {
    await attachCustomerInstrument(userId, body);

    if (body.reference_id && typeof body.reference_id === "string") {
        body.reference_id = body.reference_id.trim();
    }

    if (!body.reference_id) {
        body.reference_id = generateMandateReference(userId);
    }

    body.reference_type = body.reference_type
        ? String(body.reference_type).trim().toUpperCase()
        : "MAIN";

    const { data, synced } = await gateway.createMandate(body, {
        userId,
        ipAddress,
        source: "API",
    });

    return { mandate: formatMandate(synced), rocketpay: data };
};

exports.listMyMandates = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = { user: userId };

    if (query.state) filter.state = String(query.state).toUpperCase();
    if (query.frequency) {
        filter.frequency = String(query.frequency).toUpperCase();
    }
    if (query.search) {
        const s = String(query.search).trim();
        filter.$or = [
            { rocketpayId: { $regex: s, $options: "i" } },
            { referenceId: { $regex: s, $options: "i" } },
            { customerMobile: { $regex: s, $options: "i" } },
            { customerName: { $regex: s, $options: "i" } },
        ];
    }

    const [items, total] = await Promise.all([
        Mandate.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Mandate.countDocuments(filter),
    ]);

    return {
        mandates: items.map(formatMandate),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getMandate = async (userId, id, ipAddress, { refresh = false } = {}) => {
    const local = await exports.resolveMandate(id, { userId });

    if (refresh) {
        const { data, synced } = await gateway.getMandate(local.rocketpayId, {
            userId,
            ipAddress,
            source: "API",
        });
        return { mandate: formatMandate(synced), rocketpay: data };
    }

    return { mandate: formatMandate(local) };
};

exports.refreshMandate = async (userId, id, ipAddress) => {
    const local = await exports.resolveMandate(id, { userId });
    const { data, synced } = await gateway.refreshMandate(local.rocketpayId, {
        userId,
        ipAddress,
        source: "API",
    });
    return { mandate: formatMandate(synced), rocketpay: data };
};

exports.deleteMandate = async (userId, id, ipAddress) => {
    const local = await exports.resolveMandate(id, { userId });
    if (local.state !== "CREATED") {
        throw new ApiError(
            400,
            "Delete is only allowed when mandate is in CREATED state"
        );
    }
    const { data, synced } = await gateway.deleteMandate(local.rocketpayId, {
        userId,
        ipAddress,
        source: "API",
    });
    return { mandate: formatMandate(synced), rocketpay: data };
};

exports.cancelMandate = async (userId, id, ipAddress) => {
    const local = await exports.resolveMandate(id, { userId });
    if (local.state !== "ACTIVATED") {
        throw new ApiError(
            400,
            "Cancel is only allowed when mandate is in ACTIVATED state"
        );
    }
    const { data, synced } = await gateway.cancelMandate(local.rocketpayId, {
        userId,
        ipAddress,
        source: "API",
    });
    return { mandate: formatMandate(synced), rocketpay: data };
};

exports.createInstallment = async (userId, mandateId, body, ipAddress) => {
    const local = await exports.resolveMandate(mandateId, { userId });
    if (local.frequency !== "ADHOC") {
        throw new ApiError(
            400,
            "Create installment is only valid for ADHOC schedule mandates"
        );
    }
    const { data, synced } = await gateway.createInstallment(
        local.rocketpayId,
        body,
        { userId, ipAddress, source: "API" }
    );
    return { installment: formatInstallment(synced), rocketpay: data };
};

exports.listInstallments = async (userId, mandateId, ipAddress, query = {}) => {
    const local = await exports.resolveMandate(mandateId, { userId });
    const fromRemote = query.sync === "true" || query.sync === "1";

    if (fromRemote) {
        const { data, synced } = await gateway.listInstallments(
            local.rocketpayId,
            { userId, ipAddress, source: "API" }
        );
        return {
            installments: Array.isArray(synced)
                ? synced.map(formatInstallment)
                : [],
            rocketpay: data,
        };
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 100);
    const skip = (page - 1) * limit;
    const filter = {
        $or: [
            { mandate: local._id },
            { rocketpayMandateId: local.rocketpayId },
        ],
        user: userId,
    };
    if (query.state) filter.state = String(query.state).toUpperCase();

    const [items, total] = await Promise.all([
        Installment.find(filter)
            .sort({ dueDate: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Installment.countDocuments(filter),
    ]);

    return {
        installments: items.map(formatInstallment),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getInstallment = async (userId, id, ipAddress, { refresh = false } = {}) => {
    const local = await exports.resolveInstallment(id, { userId });

    if (refresh) {
        const { data, synced } = await gateway.getInstallment(
            local.rocketpayId,
            { userId, ipAddress, source: "API" }
        );
        return { installment: formatInstallment(synced), rocketpay: data };
    }

    return { installment: formatInstallment(local) };
};

exports.refreshInstallment = async (userId, id, ipAddress) => {
    const local = await exports.resolveInstallment(id, { userId });
    const { data, synced } = await gateway.refreshInstallment(
        local.rocketpayId,
        { userId, ipAddress, source: "API" }
    );
    return { installment: formatInstallment(synced), rocketpay: data };
};

exports.skipInstallment = async (userId, id, ipAddress) => {
    const local = await exports.resolveInstallment(id, { userId });
    const { data, synced } = await gateway.skipInstallment(local.rocketpayId, {
        userId,
        ipAddress,
        source: "API",
    });
    return { installment: formatInstallment(synced), rocketpay: data };
};

exports.retryInstallment = async (userId, id, body, ipAddress) => {
    const local = await exports.resolveInstallment(id, { userId });
    if (local.state !== "COLLECTION_FAILED") {
        throw new ApiError(
            400,
            "Retry is only allowed when installment is in COLLECTION_FAILED state"
        );
    }
    const { data, synced } = await gateway.retryInstallment(
        local.rocketpayId,
        body,
        { userId, ipAddress, source: "API" }
    );
    return { installment: formatInstallment(synced), rocketpay: data };
};
