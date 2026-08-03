const User = require("../../api/user/model");
const UserProfile = require("../../api/user/profile.model");
const Mandate = require("../../api/mandate/mandate.model");
const Installment = require("../../api/mandate/installment.model");
const MandateTransaction = require("../../api/mandate/transaction.model");
const MandateWebhookLog = require("../../api/mandate/webhookLog.model");
const MandateApiLog = require("../../api/mandate/apiLog.model");
const gateway = require("../../api/mandate/rocketpay.gateway");
const {
    formatMandate,
    formatInstallment,
    formatTransaction,
    formatWebhookLog,
    formatApiLog,
} = require("../../api/mandate/mapper");
const ApiError = require("../../../utils/ApiError");

const isObjectId = (value) => {
    const mongoose = require("mongoose");
    return (
        mongoose.Types.ObjectId.isValid(value) &&
        String(new mongoose.Types.ObjectId(value)) === String(value)
    );
};

const buildPagination = (page, limit, total) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
});

const resolveAdminMandate = async (id) => {
    const filter = isObjectId(id)
        ? { $or: [{ _id: id }, { rocketpayId: String(id) }] }
        : { rocketpayId: String(id) };
    const doc = await Mandate.findOne(filter).populate(
        "user",
        "mobile email status"
    );
    if (!doc) throw new ApiError(404, "Mandate not found");
    return doc;
};

const resolveAdminInstallment = async (id) => {
    const filter = isObjectId(id)
        ? { $or: [{ _id: id }, { rocketpayId: String(id) }] }
        : { rocketpayId: String(id) };
    const doc = await Installment.findOne(filter).populate(
        "user",
        "mobile email status"
    );
    if (!doc) throw new ApiError(404, "Installment not found");
    return doc;
};

const attachProfiles = async (userIds) => {
    const profiles = await UserProfile.find({ user: { $in: userIds } });
    return Object.fromEntries(profiles.map((p) => [p.user.toString(), p]));
};

const withUserName = (formatted, profileMap) => {
    if (!formatted?.user?.id) return formatted;
    const profile = profileMap[String(formatted.user.id)];
    if (profile) {
        formatted.user.fullName = [profile.firstName, profile.lastName]
            .filter(Boolean)
            .join(" ");
    }
    return formatted;
};

const extractInstrument = (payer) => {
    const inst = payer?.instrument;
    if (!inst || typeof inst !== "object") return null;
    return {
        type: inst.type || (inst.vpa ? "VPA" : "BANK_ACCOUNT"),
        accountNumber: inst.account_number || null,
        ifsc: inst.ifsc || null,
        accountHolderName:
            inst.account_holder_name ||
            inst.account_holder_name_at_bank ||
            null,
        vpa: inst.vpa || null,
        bankCode: inst.bank_code || null,
        branchName: inst.branch_name || null,
    };
};

const enrichMandate = (formatted, profileMap) => {
    const mandate = withUserName(formatted, profileMap);
    if (!mandate) return mandate;
    mandate.placedBy = mandate.user
        ? {
              id: mandate.user.id,
              fullName: mandate.user.fullName || "",
              mobile: mandate.user.mobile || "",
              email: mandate.user.email || "",
              status: mandate.user.status || "",
          }
        : null;
    mandate.mandateFor = {
        name: mandate.customerName || "",
        mobile: mandate.customerMobile || "",
    };
    mandate.instrument = extractInstrument(mandate.payer);
    return mandate;
};

exports.getDashboard = async () => {
    const [
        totalMandates,
        byState,
        totalInstallments,
        installmentByState,
        totalTransactions,
        totalWebhooks,
        unprocessedWebhooks,
        totalApiLogs,
        failedApiLogs,
        recentMandates,
    ] = await Promise.all([
        Mandate.countDocuments({}),
        Mandate.aggregate([
            { $group: { _id: "$state", count: { $sum: 1 } } },
        ]),
        Installment.countDocuments({}),
        Installment.aggregate([
            { $group: { _id: "$state", count: { $sum: 1 } } },
        ]),
        MandateTransaction.countDocuments({}),
        MandateWebhookLog.countDocuments({}),
        MandateWebhookLog.countDocuments({ processed: false }),
        MandateApiLog.countDocuments({}),
        MandateApiLog.countDocuments({
            status: { $in: ["FAILED", "ERROR"] },
        }),
        Mandate.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("user", "mobile email status"),
    ]);

    const mandateStateCounts = Object.fromEntries(
        byState.map((r) => [r._id || "UNKNOWN", r.count])
    );
    const installmentStateCounts = Object.fromEntries(
        installmentByState.map((r) => [r._id || "UNKNOWN", r.count])
    );

    const recentIds = recentMandates
        .map((m) => m.user?._id?.toString())
        .filter(Boolean);
    const recentProfiles = await attachProfiles(recentIds);

    return {
        summary: {
            totalMandates,
            totalInstallments,
            totalTransactions,
            totalWebhooks,
            unprocessedWebhooks,
            totalApiLogs,
            failedApiLogs,
            activatedMandates: mandateStateCounts.ACTIVATED || 0,
            createdMandates: mandateStateCounts.CREATED || 0,
            cancelledMandates: mandateStateCounts.CANCELLED || 0,
            completedMandates: mandateStateCounts.COMPLETED || 0,
            collectionFailedInstallments:
                installmentStateCounts.COLLECTION_FAILED || 0,
            settlementSuccessInstallments:
                installmentStateCounts.SETTLEMENT_SUCCESS || 0,
        },
        mandateStateCounts,
        installmentStateCounts,
        recentMandates: recentMandates.map((m) =>
            enrichMandate(formatMandate(m), recentProfiles)
        ),
    };
};

exports.getMandates = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.state) filter.state = String(query.state).toUpperCase();
    if (query.frequency) {
        filter.frequency = String(query.frequency).toUpperCase();
    }
    if (query.mode) filter.mode = String(query.mode).toUpperCase();
    if (query.deleted === "true" || query.deleted === "1") {
        filter.deleted = true;
    } else if (query.deleted === "false" || query.deleted === "0") {
        filter.deleted = false;
    }
    if (query.userId) filter.user = query.userId;

    if (query.search) {
        const s = String(query.search).trim();
        const users = await User.find({
            mobile: { $regex: s, $options: "i" },
            isDeleted: false,
        }).select("_id");

        filter.$or = [
            { rocketpayId: { $regex: s, $options: "i" } },
            { referenceId: { $regex: s, $options: "i" } },
            { customerMobile: { $regex: s, $options: "i" } },
            { customerName: { $regex: s, $options: "i" } },
            { user: { $in: users.map((u) => u._id) } },
        ];
    }

    const sortDir = query.sortOrder === "asc" ? 1 : -1;
    const sortField = query.sortBy === "state" ? "state" : "createdAt";

    const [items, total] = await Promise.all([
        Mandate.find(filter)
            .populate("user", "mobile email status")
            .sort({ [sortField]: sortDir })
            .skip(skip)
            .limit(limit),
        Mandate.countDocuments(filter),
    ]);

    const userIds = items
        .map((m) => m.user?._id?.toString())
        .filter(Boolean);
    const profileMap = await attachProfiles(userIds);

    return {
        mandates: items.map((m) =>
            enrichMandate(formatMandate(m), profileMap)
        ),
        pagination: buildPagination(page, limit, total),
    };
};

exports.getMandateById = async (id) => {
    const doc = await resolveAdminMandate(id);
    const profileMap = doc.user?._id
        ? await attachProfiles([doc.user._id.toString()])
        : {};
    const mandate = enrichMandate(formatMandate(doc), profileMap);

    const [installments, transactions] = await Promise.all([
        Installment.find({ mandate: doc._id })
            .sort({ dueDate: 1, createdAt: 1 })
            .limit(50),
        MandateTransaction.find({
            $or: [{ mandate: doc._id }, { rocketpayMandateId: doc.rocketpayId }],
        })
            .sort({ createdAt: -1 })
            .limit(30),
    ]);

    mandate.relatedInstallments = installments.map(formatInstallment);
    mandate.relatedTransactions = transactions.map(formatTransaction);
    return mandate;
};

exports.refreshMandate = async (id, adminUserId, ipAddress) => {
    const local = await resolveAdminMandate(id);
    const { data, synced } = await gateway.refreshMandate(local.rocketpayId, {
        userId: adminUserId,
        ipAddress,
        source: "ADMIN",
    });
    return { mandate: formatMandate(synced), rocketpay: data };
};

exports.cancelMandate = async (id, adminUserId, ipAddress) => {
    const local = await resolveAdminMandate(id);
    if (local.state !== "ACTIVATED") {
        throw new ApiError(
            400,
            "Cancel is only allowed when mandate is in ACTIVATED state"
        );
    }
    const { data, synced } = await gateway.cancelMandate(local.rocketpayId, {
        userId: adminUserId,
        ipAddress,
        source: "ADMIN",
    });
    return { mandate: formatMandate(synced), rocketpay: data };
};

exports.reconMandates = async (body = {}, adminUserId, ipAddress) => {
    const pageNumber = Number(body.page_number) || 1;
    const pageSize = Math.min(Number(body.page_size) || 100, 100);
    let ids = Array.isArray(body.ids)
        ? body.ids.map(String).filter(Boolean)
        : [];

    if (!ids.length) {
        const docs = await Mandate.find({
            rocketpayId: { $ne: null },
            deleted: { $ne: true },
        })
            .sort({ createdAt: 1 })
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize)
            .select("rocketpayId");
        ids = docs.map((d) => d.rocketpayId).filter(Boolean);
    }

    if (!ids.length) {
        return {
            synced: [],
            rocketpay: {
                items: [],
                pagination: {
                    page_number: pageNumber,
                    page_size: pageSize,
                    total_items: 0,
                    total_pages: 0,
                },
            },
        };
    }

    const payload = {
        page_number: pageNumber,
        page_size: pageSize,
        ids,
    };
    const { data, synced } = await gateway.reconMandates(payload, {
        userId: adminUserId,
        ipAddress,
        source: "ADMIN",
    });

    const list = Array.isArray(synced) ? synced : synced ? [synced] : [];
    const userIds = list
        .map((m) => m.user?._id?.toString() || m.user?.toString?.())
        .filter(Boolean);
    const profileMap = await attachProfiles(userIds);

    return {
        synced: list.map((m) => enrichMandate(formatMandate(m), profileMap)),
        rocketpay: data,
        requestedIds: ids,
    };
};

exports.getInstallments = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const filter = {};
    const and = [];

    if (query.state) filter.state = String(query.state).toUpperCase();

    if (query.mandateId) {
        if (isObjectId(query.mandateId)) {
            and.push({
                $or: [
                    { mandate: query.mandateId },
                    { rocketpayMandateId: String(query.mandateId) },
                ],
            });
        } else {
            filter.rocketpayMandateId = String(query.mandateId);
        }
    }
    if (query.rocketpayMandateId) {
        filter.rocketpayMandateId = String(query.rocketpayMandateId);
    }

    if (query.search) {
        const s = String(query.search).trim();
        and.push({
            $or: [
                { rocketpayId: { $regex: s, $options: "i" } },
                { referenceId: { $regex: s, $options: "i" } },
                { rocketpayMandateId: { $regex: s, $options: "i" } },
            ],
        });
    }

    if (and.length) {
        filter.$and = and;
    }

    const [items, total] = await Promise.all([
        Installment.find(filter)
            .populate("user", "mobile email status")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Installment.countDocuments(filter),
    ]);

    const userIds = items
        .map((m) => m.user?._id?.toString())
        .filter(Boolean);
    const profileMap = await attachProfiles(userIds);

    return {
        installments: items.map((item) => {
            const formatted = withUserName(formatInstallment(item), profileMap);
            if (formatted) {
                formatted.placedBy = formatted.user
                    ? {
                          id: formatted.user.id,
                          fullName: formatted.user.fullName || "",
                          mobile: formatted.user.mobile || "",
                          email: formatted.user.email || "",
                      }
                    : null;
                formatted.mandateFor = {
                    name: item.payer?.account?.name || "",
                    mobile: item.payer?.account?.mobile_number || "",
                };
            }
            return formatted;
        }),
        pagination: buildPagination(page, limit, total),
    };
};

exports.getInstallmentById = async (id) => {
    const doc = await resolveAdminInstallment(id);
    const profileMap = doc.user?._id
        ? await attachProfiles([doc.user._id.toString()])
        : {};
    const formatted = withUserName(formatInstallment(doc), profileMap);
    if (formatted) {
        formatted.placedBy = formatted.user
            ? {
                  id: formatted.user.id,
                  fullName: formatted.user.fullName || "",
                  mobile: formatted.user.mobile || "",
                  email: formatted.user.email || "",
              }
            : null;
        formatted.mandateFor = {
            name: doc.payer?.account?.name || "",
            mobile: doc.payer?.account?.mobile_number || "",
        };
        formatted.instrument = extractInstrument(doc.payer);
    }
    return formatted;
};

exports.refreshInstallment = async (id, adminUserId, ipAddress) => {
    const local = await resolveAdminInstallment(id);
    const { data, synced } = await gateway.refreshInstallment(
        local.rocketpayId,
        { userId: adminUserId, ipAddress, source: "ADMIN" }
    );
    return { installment: formatInstallment(synced), rocketpay: data };
};

exports.skipInstallment = async (id, adminUserId, ipAddress) => {
    const local = await resolveAdminInstallment(id);
    const { data, synced } = await gateway.skipInstallment(local.rocketpayId, {
        userId: adminUserId,
        ipAddress,
        source: "ADMIN",
    });
    return { installment: formatInstallment(synced), rocketpay: data };
};

exports.retryInstallment = async (id, body, adminUserId, ipAddress) => {
    const local = await resolveAdminInstallment(id);
    if (local.state !== "COLLECTION_FAILED") {
        throw new ApiError(
            400,
            "Retry is only allowed when installment is in COLLECTION_FAILED state"
        );
    }
    const { data, synced } = await gateway.retryInstallment(
        local.rocketpayId,
        body,
        { userId: adminUserId, ipAddress, source: "ADMIN" }
    );
    return { installment: formatInstallment(synced), rocketpay: data };
};

exports.reconInstallments = async (body = {}, adminUserId, ipAddress) => {
    const pageNumber = Number(body.page_number) || 1;
    const pageSize = Math.min(Number(body.page_size) || 100, 100);
    let ids = Array.isArray(body.ids)
        ? body.ids.map(String).filter(Boolean)
        : [];

    if (!ids.length) {
        const docs = await Installment.find({
            rocketpayId: { $ne: null },
            deleted: { $ne: true },
        })
            .sort({ createdAt: 1 })
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize)
            .select("rocketpayId");
        ids = docs.map((d) => d.rocketpayId).filter(Boolean);
    }

    if (!ids.length) {
        return {
            synced: [],
            rocketpay: {
                items: [],
                pagination: {
                    page_number: pageNumber,
                    page_size: pageSize,
                    total_items: 0,
                    total_pages: 0,
                },
            },
        };
    }

    const payload = {
        page_number: pageNumber,
        page_size: pageSize,
        ids,
    };
    const { data, synced } = await gateway.reconInstallments(payload, {
        userId: adminUserId,
        ipAddress,
        source: "ADMIN",
    });

    const list = Array.isArray(synced) ? synced : synced ? [synced] : [];
    return {
        synced: list.map(formatInstallment),
        rocketpay: data,
        requestedIds: ids,
    };
};

exports.getTransactions = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.entityType) {
        filter.entityType = String(query.entityType).toUpperCase();
    }
    if (query.state) filter.state = String(query.state).toUpperCase();
    if (query.mandateId) {
        if (isObjectId(query.mandateId)) filter.mandate = query.mandateId;
        else filter.rocketpayMandateId = String(query.mandateId);
    }
    if (query.installmentId) {
        if (isObjectId(query.installmentId)) {
            filter.installment = query.installmentId;
        } else {
            filter.rocketpayInstallmentId = String(query.installmentId);
        }
    }
    if (query.search) {
        const s = String(query.search).trim();
        filter.$or = [
            { rocketpayTxnId: { $regex: s, $options: "i" } },
            { utr: { $regex: s, $options: "i" } },
            { rocketpayMandateId: { $regex: s, $options: "i" } },
            { rocketpayInstallmentId: { $regex: s, $options: "i" } },
        ];
    }

    const [items, total] = await Promise.all([
        MandateTransaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        MandateTransaction.countDocuments(filter),
    ]);

    return {
        transactions: items.map(formatTransaction),
        pagination: buildPagination(page, limit, total),
    };
};

exports.getWebhookLogs = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.entityType) {
        filter.entityType = String(query.entityType).toUpperCase();
    }
    if (query.processed === "true" || query.processed === "1") {
        filter.processed = true;
    } else if (query.processed === "false" || query.processed === "0") {
        filter.processed = false;
    }
    if (query.search) {
        const s = String(query.search).trim();
        filter.$or = [
            { rocketpayEntityId: { $regex: s, $options: "i" } },
            { processError: { $regex: s, $options: "i" } },
            { ipAddress: { $regex: s, $options: "i" } },
        ];
    }

    const [items, total] = await Promise.all([
        MandateWebhookLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        MandateWebhookLog.countDocuments(filter),
    ]);

    return {
        webhooks: items.map(formatWebhookLog),
        pagination: buildPagination(page, limit, total),
    };
};

exports.getApiLogs = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.status) filter.status = String(query.status).toUpperCase();
    if (query.apiName) {
        filter.apiName = {
            $regex: String(query.apiName).trim(),
            $options: "i",
        };
    }
    if (query.userId) filter.user = query.userId;
    if (query.search) {
        const s = String(query.search).trim();
        filter.$or = [
            { apiName: { $regex: s, $options: "i" } },
            { path: { $regex: s, $options: "i" } },
            { error: { $regex: s, $options: "i" } },
            { ipAddress: { $regex: s, $options: "i" } },
            { rocketpayMandateId: { $regex: s, $options: "i" } },
            { rocketpayInstallmentId: { $regex: s, $options: "i" } },
        ];
    }

    const [items, total] = await Promise.all([
        MandateApiLog.find(filter)
            .populate("user", "mobile email status")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        MandateApiLog.countDocuments(filter),
    ]);

    return {
        logs: items.map(formatApiLog),
        pagination: buildPagination(page, limit, total),
    };
};
