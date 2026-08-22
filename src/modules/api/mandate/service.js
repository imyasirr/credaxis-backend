const crypto = require("crypto");
const mongoose = require("mongoose");
const Mandate = require("./mandate.model");
const Installment = require("./installment.model");
const BankAccount = require("../wallet/bankAccount.model");
const User = require("../user/model");
const UserProfile = require("../user/profile.model");
const Partner = require("../partner/model");
const gateway = require("./rocketpay.gateway");
const { formatMandate, formatInstallment } = require("./mapper");
const ApiError = require("../../../utils/ApiError");
const {
    RECEIVED_INSTALLMENT_STATES,
    SETTLED_INSTALLMENT_STATES,
    PENDING_INSTALLMENT_STATES,
    FAILED_INSTALLMENT_STATES,
} = require("./constants");

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

const normalizeMobile = (mobile) => {
    const raw = String(mobile || "").trim();
    if (!raw) return null;
    if (raw.startsWith("+")) return raw;
    if (/^[6-9]\d{9}$/.test(raw)) return `+91${raw}`;
    return raw;
};

/**
 * Mandate creator = collector / distributor (Yasir).
 * Customer in body = payer who approves AutoPay (Vivek).
 */
const resolveDistributorProfile = async (userId) => {
    const [user, profile, partner] = await Promise.all([
        User.findById(userId).select("mobile email"),
        UserProfile.findOne({ user: userId }).select("firstName lastName"),
        Partner.findOne({ user: userId, status: "APPROVED" }).select(
            "businessName businessType ownerName rocketpayAccountId email"
        ),
    ]);

    const profileName = [profile?.firstName, profile?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
    const businessName = partner?.businessName?.trim() || null;
    const ownerName = partner?.ownerName?.trim() || null;
    const name =
        businessName || ownerName || profileName || user?.mobile || "CredAxis";

    const rocketpayAccountId =
        partner?.rocketpayAccountId?.trim() ||
        process.env.ROCKETPAY_DEFAULT_PAYEE_ACCOUNT_ID?.trim() ||
        null;

    return {
        userId,
        name,
        mobile: normalizeMobile(user?.mobile),
        email: partner?.email || user?.email || null,
        businessName,
        businessType: partner?.businessType || null,
        rocketpayAccountId,
    };
};

/**
 * Prefer body customer.instrument (payer). If missing, use JWT user's primary bank.
 */
const attachCustomerInstrument = async (userId, body) => {
    const instrument = body.customer?.instrument;
    if (instrument && typeof instrument === "object") {
        const type = String(instrument.type || "").trim().toUpperCase();
        if (type) instrument.type = type;

        if (type === "VPA") {
            if (!String(instrument.vpa || "").trim()) {
                throw new ApiError(
                    400,
                    "customer.instrument.vpa is required when type is VPA"
                );
            }
            return;
        }

        const requiredFields = [
            "account_number",
            "ifsc",
            "account_holder_name",
            "account_type",
        ];
        const missing = requiredFields.filter(
            (field) => !String(instrument[field] || "").trim()
        );
        if (missing.length > 0) {
            throw new ApiError(
                400,
                `customer.instrument missing fields: ${missing.join(", ")}`
            );
        }

        if (!instrument.type) instrument.type = "BANK_ACCOUNT";
        instrument.account_type = toRocketPayAccountType(
            instrument.account_type
        );
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
            "Primary bank account not found. Add a primary bank account or send customer.instrument"
        );
    }

    body.customer = body.customer || {};
    body.customer.instrument = buildBankInstrument(bankAccount);
};

/**
 * Put distributor identity into RocketPay client_meta (+ optional payees.account_id).
 */
const attachDistributorToRocketPayBody = (rpBody, distributor) => {
    const incomingMeta =
        rpBody.client_meta && typeof rpBody.client_meta === "object"
            ? { ...rpBody.client_meta }
            : {};

    rpBody.client_meta = {
        ...incomingMeta,
        com_enabled: false,
        // Display hints for RocketPay / UPI (when supported by gateway)
        merchant_name: distributor.name,
        merchant_mobile: distributor.mobile,
        distributor_name: distributor.name,
        distributor_mobile: distributor.mobile,
        business_name: distributor.businessName || distributor.name,
    };

    // Always set payees when distributor has a RocketPay sub-account
    if (distributor.rocketpayAccountId) {
        rpBody.payees = [
            {
                account_id: distributor.rocketpayAccountId,
            },
        ];
    }

    return rpBody;
};

exports.resolveMandate = async (
    idOrRpId,
    { userId = null, includeDeleted = false } = {}
) => {
    const filter = isObjectId(idOrRpId)
        ? { $or: [{ _id: idOrRpId }, { rocketpayId: String(idOrRpId) }] }
        : { rocketpayId: String(idOrRpId) };

    if (userId) {
        filter.user = userId;
    }
    if (!includeDeleted) {
        filter.deleted = { $ne: true };
    }

    const doc = await Mandate.findOne(filter);
    if (!doc) {
        throw new ApiError(404, "Mandate not found");
    }
    return doc;
};

exports.resolveInstallment = async (
    idOrRpId,
    { userId = null, includeDeleted = false } = {}
) => {
    const filter = isObjectId(idOrRpId)
        ? { $or: [{ _id: idOrRpId }, { rocketpayId: String(idOrRpId) }] }
        : { rocketpayId: String(idOrRpId) };

    if (userId) {
        filter.user = userId;
    }
    if (!includeDeleted) {
        filter.deleted = { $ne: true };
    }

    const doc = await Installment.findOne(filter);
    if (!doc) {
        throw new ApiError(404, "Installment not found");
    }
    return doc;
};

exports.createMandate = async (userId, body, ipAddress) => {
    const paymentService = require("../payments/service");
    const mandateCreateFeeService = require("../payments/mandateCreateFee.service");

    const frequency = String(
        body.schedule?.frequency || body.frequency || ""
    )
        .trim()
        .toUpperCase();
    const installmentCount = Number(
        body.schedule?.installment_count ??
        body.installment_count ??
        body.installmentCount ??
        0
    );

    const fees = await mandateCreateFeeService.computeMandateSetupFees({
        frequency: frequency || null,
        installmentCount,
    });

    const paymentId = body.paymentId || body.payment_id || null;
    let claimedPayment = null;

    try {
        if (fees.paymentRequired) {
            claimedPayment = await paymentService.consumeMandateCreatePayment(
                userId,
                paymentId
            );

            const paid = Number(claimedPayment.amount) || 0;
            const expected = Number(fees.grandTotal) || 0;
            if (Math.abs(paid - expected) > 0.009) {
                throw new ApiError(
                    400,
                    `Payment amount ₹${paid} does not match required mandate fees ₹${expected} for this schedule. Re-quote with frequency + installment_count and pay again.`
                );
            }

            const metaFreq = String(
                claimedPayment.meta?.frequency || ""
            ).toUpperCase();
            const metaCount = Number(
                claimedPayment.meta?.installmentCount ?? 0
            );
            if (metaFreq && frequency && metaFreq !== frequency) {
                throw new ApiError(
                    400,
                    `Payment was for frequency ${metaFreq} but mandate is ${frequency}`
                );
            }
            if (
                metaCount > 0 &&
                Number(fees.installmentFee.installmentCount) > 0 &&
                metaCount !== Number(fees.installmentFee.installmentCount)
            ) {
                throw new ApiError(
                    400,
                    `Payment was for ${metaCount} installment(s) but mandate has ${fees.installmentFee.installmentCount}`
                );
            }
        }

        // Strip payment fields — not sent to RocketPay
        const rpBody = { ...body };
        delete rpBody.paymentId;
        delete rpBody.payment_id;
        delete rpBody.installmentCount;
        delete rpBody.installment_count;

        await attachCustomerInstrument(userId, rpBody);

        const distributor = await resolveDistributorProfile(userId);
        attachDistributorToRocketPayBody(rpBody, distributor);

        if (rpBody.reference_id && typeof rpBody.reference_id === "string") {
            rpBody.reference_id = rpBody.reference_id.trim();
        }

        if (!rpBody.reference_id) {
            rpBody.reference_id = generateMandateReference(userId);
        }

        rpBody.reference_type = rpBody.reference_type
            ? String(rpBody.reference_type).trim().toUpperCase()
            : "MAIN";

        const { data, synced } = await gateway.createMandate(rpBody, {
            userId,
            ipAddress,
            source: "API",
            distributor,
        });

        if (!synced?._id && !synced?.id) {
            throw new ApiError(
                502,
                "Mandate created on RocketPay but local sync failed"
            );
        }

        // Ensure local snapshot even if RocketPay strips client_meta display fields
        if (synced?._id || synced?.id) {
            await Mandate.updateOne(
                { _id: synced._id || synced.id },
                {
                    $set: {
                        distributor: {
                            userId: distributor.userId,
                            name: distributor.name,
                            mobile: distributor.mobile,
                            email: distributor.email,
                            businessName: distributor.businessName,
                            businessType: distributor.businessType,
                            rocketpayAccountId: distributor.rocketpayAccountId,
                        },
                        clientMeta: rpBody.client_meta,
                    },
                }
            );
            synced.distributor = {
                userId: distributor.userId,
                name: distributor.name,
                mobile: distributor.mobile,
                email: distributor.email,
                businessName: distributor.businessName,
                businessType: distributor.businessType,
                rocketpayAccountId: distributor.rocketpayAccountId,
            };
            synced.clientMeta = rpBody.client_meta;
        }

        if (claimedPayment?._id) {
            await paymentService.attachMandateReference(
                claimedPayment._id,
                synced?._id || synced?.id
            );
        }

        return {
            mandate: formatMandate(synced),
            rocketpay: data,
            fees,
            ...(claimedPayment
                ? {
                      payment: {
                          id: String(claimedPayment._id),
                          method: claimedPayment.method,
                          amount: claimedPayment.amount,
                      },
                  }
                : {}),
        };
    } catch (error) {
        if (claimedPayment?._id) {
            await paymentService.releaseConsumedPayment(claimedPayment._id);
        }
        throw error;
    }
};

exports.listMyMandates = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = { user: userId, deleted: { $ne: true } };

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
            local.state === "ACTIVATED"
                ? "Activated mandates cannot be deleted. Use POST /api/mandates/:id/cancel"
                : "Delete is only allowed when mandate is in CREATED state"
        );
    }
    const { data, synced } = await gateway.deleteMandate(local.rocketpayId, {
        userId,
        ipAddress,
        source: "API",
    });

    // Safety: always soft-delete locally even if RocketPay body/sync was empty
    let mandateDoc = synced;
    if (!mandateDoc?.deleted) {
        local.deleted = true;
        local.lastSyncedAt = new Date();
        await local.save();
        mandateDoc = local;
    }

    return { mandate: formatMandate(mandateDoc), rocketpay: data };
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
    if (local.state !== "ACTIVATED") {
        throw new ApiError(
            400,
            "Create installment is only allowed when mandate is ACTIVATED"
        );
    }

    const paymentService = require("../payments/service");
    const mandateInstallmentFeeService = require("../payments/mandateInstallmentFee.service");
    const adhocFee =
        await mandateInstallmentFeeService.computeAdhocInstallmentCreateFee();

    const paymentId = body.paymentId || body.payment_id || null;
    let claimedPayment = null;

    try {
        if (adhocFee.enabled && adhocFee.amount > 0) {
            claimedPayment = await paymentService.consumeMandateCreatePayment(
                userId,
                paymentId
            );
            const paid = Number(claimedPayment.amount) || 0;
            if (Math.abs(paid - adhocFee.amount) > 0.009) {
                throw new ApiError(
                    400,
                    `Payment amount ₹${paid} does not match ADHOC installment fee ₹${adhocFee.amount}`
                );
            }
            if (claimedPayment.meta?.adhocInstallmentOnly !== true) {
                throw new ApiError(
                    400,
                    "Use a payment created with adhocInstallmentOnly: true for ADHOC installment fee"
                );
            }
        }

        const rpBody = { ...body };
        delete rpBody.paymentId;
        delete rpBody.payment_id;

        const { data, synced } = await gateway.createInstallment(
            local.rocketpayId,
            rpBody,
            { userId, ipAddress, source: "API" }
        );

        if (!synced?._id && !synced?.id) {
            throw new ApiError(
                502,
                "Installment created on RocketPay but local sync failed"
            );
        }

        if (claimedPayment?._id) {
            await paymentService.attachMandateReference(
                claimedPayment._id,
                local._id
            );
        }

        return {
            installment: formatInstallment(synced),
            rocketpay: data,
            ...(claimedPayment
                ? {
                    payment: {
                        id: String(claimedPayment._id),
                        method: claimedPayment.method,
                        amount: claimedPayment.amount,
                    },
                }
                : {}),
        };
    } catch (error) {
        if (claimedPayment?._id) {
            await paymentService.releaseConsumedPayment(claimedPayment._id);
        }
        throw error;
    }
};

exports.listInstallments = async (userId, mandateId, ipAddress, query = {}) => {
    const local = await exports.resolveMandate(mandateId, { userId });
    const fromRemote = query.sync === "true" || query.sync === "1";

    const buildLocalResult = async () => {
        const page = Number(query.page) || 1;
        const limit = Math.min(Number(query.limit) || 50, 100);
        const skip = (page - 1) * limit;
        const filter = {
            $or: [
                { mandate: local._id },
                { rocketpayMandateId: local.rocketpayId },
            ],
            user: userId,
            deleted: { $ne: true },
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

    if (fromRemote) {
        const { data, synced } = await gateway.listInstallments(
            local.rocketpayId,
            { userId, ipAddress, source: "API" }
        );
        let items = Array.isArray(synced) ? synced : [];
        if (query.state) {
            const state = String(query.state).toUpperCase();
            items = items.filter((i) => i.state === state);
        }
        const page = Number(query.page) || 1;
        const limit = Math.min(Number(query.limit) || 50, 100);
        const total = items.length;
        const skip = (page - 1) * limit;
        const pageItems = items.slice(skip, skip + limit);
        return {
            installments: pageItems.map(formatInstallment),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 0,
            },
            rocketpay: data,
            syncedFromRocketPay: true,
        };
    }

    const localResult = await buildLocalResult();

    // Mandate pe installmentCount hai lekin local empty → RocketPay se pull
    if (
        localResult.pagination.total === 0 &&
        Number(local.installmentCount) > 0 &&
        local.rocketpayId
    ) {
        const { data, synced } = await gateway.listInstallments(
            local.rocketpayId,
            { userId, ipAddress, source: "API" }
        );
        if (Array.isArray(synced) && synced.length > 0) {
            let items = synced;
            if (query.state) {
                const state = String(query.state).toUpperCase();
                items = items.filter((i) => i.state === state);
            }
            const page = Number(query.page) || 1;
            const limit = Math.min(Number(query.limit) || 50, 100);
            const total = items.length;
            const skip = (page - 1) * limit;
            return {
                installments: items
                    .slice(skip, skip + limit)
                    .map(formatInstallment),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 0,
                },
                rocketpay: data,
                syncedFromRocketPay: true,
            };
        }
    }

    return localResult;
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

    if (local.dueDate) {
        const due = new Date(`${local.dueDate}T00:00:00+05:30`);
        if (!Number.isNaN(due.getTime())) {
            const msLeft = due.getTime() - Date.now();
            const daysLeft = msLeft / (24 * 60 * 60 * 1000);
            if (daysLeft < 2) {
                throw new ApiError(
                    400,
                    "Skip is only allowed when due date is at least 2 days away"
                );
            }
        }
    }

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

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const emptyMoneyBucket = () => ({
    amount: 0,
    count: 0,
});

const classifyInstallmentMoney = (state, amount) => {
    const amt = Number(amount) || 0;
    const s = String(state || "").toUpperCase();
    return {
        amount: amt,
        isExpected: s !== "TERMINATED",
        isReceived: RECEIVED_INSTALLMENT_STATES.includes(s),
        isSettled: SETTLED_INSTALLMENT_STATES.includes(s),
        isPending: PENDING_INSTALLMENT_STATES.includes(s),
        isFailed: FAILED_INSTALLMENT_STATES.includes(s),
        isTerminated: s === "TERMINATED",
    };
};

const accumulateMoney = (bucket, row) => {
    const next = {
        expected: { ...bucket.expected },
        received: { ...bucket.received },
        settled: { ...bucket.settled },
        pending: { ...bucket.pending },
        failed: { ...bucket.failed },
        terminated: { ...bucket.terminated },
        total: { ...bucket.total },
    };

    next.total.amount = roundMoney(next.total.amount + row.amount);
    next.total.count += 1;

    if (row.isTerminated) {
        next.terminated.amount = roundMoney(next.terminated.amount + row.amount);
        next.terminated.count += 1;
        return next;
    }

    if (row.isExpected) {
        next.expected.amount = roundMoney(next.expected.amount + row.amount);
        next.expected.count += 1;
    }
    if (row.isReceived) {
        next.received.amount = roundMoney(next.received.amount + row.amount);
        next.received.count += 1;
    }
    if (row.isSettled) {
        next.settled.amount = roundMoney(next.settled.amount + row.amount);
        next.settled.count += 1;
    }
    if (row.isPending) {
        next.pending.amount = roundMoney(next.pending.amount + row.amount);
        next.pending.count += 1;
    }
    if (row.isFailed) {
        next.failed.amount = roundMoney(next.failed.amount + row.amount);
        next.failed.count += 1;
    }

    return next;
};

const finalizeMoneySummary = (bucket) => {
    const expectedAmount = roundMoney(bucket.expected.amount);
    const receivedAmount = roundMoney(bucket.received.amount);
    return {
        currency: "INR",
        /** Installment totals merchant should collect (excludes TERMINATED) */
        expectedAmount,
        expectedCount: bucket.expected.count,
        /** Collected from customer (COLLECTION_SUCCESS / settlement pipeline) */
        receivedAmount,
        receivedCount: bucket.received.count,
        /** Settled to merchant bank (SETTLEMENT_SUCCESS) */
        settledAmount: roundMoney(bucket.settled.amount),
        settledCount: bucket.settled.count,
        /** Still due / in progress */
        pendingAmount: roundMoney(bucket.pending.amount),
        pendingCount: bucket.pending.count,
        /** Collection or settlement failed */
        failedAmount: roundMoney(bucket.failed.amount),
        failedCount: bucket.failed.count,
        terminatedAmount: roundMoney(bucket.terminated.amount),
        terminatedCount: bucket.terminated.count,
        /** expected − received */
        remainingAmount: roundMoney(expectedAmount - receivedAmount),
        totalInstallments: bucket.total.count,
    };
};

const emptyMoneySummary = () =>
    finalizeMoneySummary({
        expected: emptyMoneyBucket(),
        received: emptyMoneyBucket(),
        settled: emptyMoneyBucket(),
        pending: emptyMoneyBucket(),
        failed: emptyMoneyBucket(),
        terminated: emptyMoneyBucket(),
        total: emptyMoneyBucket(),
    });

const buildInstallmentMatchForUser = async (userId, query = {}) => {
    const mandateFilter = { user: userId, deleted: { $ne: true } };
    if (query.mandateId && isObjectId(query.mandateId)) {
        mandateFilter._id = query.mandateId;
    }
    if (query.state) {
        mandateFilter.state = String(query.state).toUpperCase();
    }
    if (query.customerMobile) {
        const mobile = String(query.customerMobile).trim();
        mandateFilter.customerMobile = { $regex: mobile, $options: "i" };
    }
    if (query.search) {
        const s = String(query.search).trim();
        mandateFilter.$or = [
            { customerMobile: { $regex: s, $options: "i" } },
            { customerName: { $regex: s, $options: "i" } },
            { rocketpayId: { $regex: s, $options: "i" } },
            { referenceId: { $regex: s, $options: "i" } },
        ];
    }

    const mandates = await Mandate.find(mandateFilter)
        .select("_id rocketpayId customerName customerMobile state frequency mode approvalAmount installmentCount createdAt")
        .sort({ createdAt: -1 })
        .lean();

    return mandates;
};

/**
 * Merchant collection overview from local installments.
 * expected = aane chahiye, received = aa gaye (customer se collect).
 */
exports.getCollectionsSummary = async (userId, query = {}) => {
    const mandates = await buildInstallmentMatchForUser(userId, query);
    if (!mandates.length) {
        return {
            summary: emptyMoneySummary(),
            mandateCount: 0,
        };
    }

    const mandateIds = mandates.map((m) => m._id);
    const rocketpayIds = mandates.map((m) => m.rocketpayId).filter(Boolean);

    const installments = await Installment.find({
        deleted: { $ne: true },
        $or: [
            { mandate: { $in: mandateIds } },
            ...(rocketpayIds.length
                ? [{ rocketpayMandateId: { $in: rocketpayIds } }]
                : []),
        ],
    })
        .select("_id rocketpayId mandate rocketpayMandateId amount state")
        .lean();

    const mandateIdSet = new Set(mandateIds.map(String));
    const rpIdSet = new Set(rocketpayIds.map(String));

    let bucket = {
        expected: emptyMoneyBucket(),
        received: emptyMoneyBucket(),
        settled: emptyMoneyBucket(),
        pending: emptyMoneyBucket(),
        failed: emptyMoneyBucket(),
        terminated: emptyMoneyBucket(),
        total: emptyMoneyBucket(),
    };

    const seen = new Set();
    for (const inst of installments) {
        const idKey = String(inst._id || inst.rocketpayId || "");
        if (idKey && seen.has(idKey)) continue;
        if (idKey) seen.add(idKey);

        const belongs =
            (inst.mandate && mandateIdSet.has(String(inst.mandate))) ||
            (inst.rocketpayMandateId &&
                rpIdSet.has(String(inst.rocketpayMandateId)));
        if (!belongs) continue;
        bucket = accumulateMoney(
            bucket,
            classifyInstallmentMoney(inst.state, inst.amount)
        );
    }

    return {
        summary: finalizeMoneySummary(bucket),
        mandateCount: mandates.length,
    };
};

/**
 * Per-mandate expected vs received (paginated).
 */
exports.listMandateCollections = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const mandates = await buildInstallmentMatchForUser(userId, query);
    const total = mandates.length;
    const pageMandates = mandates.slice(skip, skip + limit);

    if (!pageMandates.length) {
        return {
            summary: (await exports.getCollectionsSummary(userId, query)).summary,
            mandates: [],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 0,
            },
        };
    }

    const mandateIds = pageMandates.map((m) => m._id);
    const rocketpayIds = pageMandates.map((m) => m.rocketpayId).filter(Boolean);

    const installments = await Installment.find({
        deleted: { $ne: true },
        $or: [
            { mandate: { $in: mandateIds } },
            ...(rocketpayIds.length
                ? [{ rocketpayMandateId: { $in: rocketpayIds } }]
                : []),
        ],
    })
        .select(
            "mandate rocketpayMandateId amount state dueDate scheduleDate rocketpayId"
        )
        .sort({ dueDate: 1, createdAt: 1 })
        .lean();

    const byMandate = new Map();
    for (const m of pageMandates) {
        byMandate.set(String(m._id), []);
        if (m.rocketpayId) {
            byMandate.set(`rp:${m.rocketpayId}`, []);
        }
    }

    for (const inst of installments) {
        const key = inst.mandate
            ? String(inst.mandate)
            : inst.rocketpayMandateId
              ? `rp:${inst.rocketpayMandateId}`
              : null;
        if (!key || !byMandate.has(key)) continue;
        byMandate.get(key).push(inst);
    }

    const rows = pageMandates.map((m) => {
        const list =
            byMandate.get(String(m._id)) ||
            (m.rocketpayId ? byMandate.get(`rp:${m.rocketpayId}`) : []) ||
            [];

        let bucket = {
            expected: emptyMoneyBucket(),
            received: emptyMoneyBucket(),
            settled: emptyMoneyBucket(),
            pending: emptyMoneyBucket(),
            failed: emptyMoneyBucket(),
            terminated: emptyMoneyBucket(),
            total: emptyMoneyBucket(),
        };

        for (const inst of list) {
            bucket = accumulateMoney(
                bucket,
                classifyInstallmentMoney(inst.state, inst.amount)
            );
        }

        const money = finalizeMoneySummary(bucket);
        return {
            id: m._id,
            rocketpayId: m.rocketpayId,
            customerName: m.customerName || null,
            customerMobile: m.customerMobile || null,
            state: m.state,
            frequency: m.frequency,
            mode: m.mode,
            approvalAmount: m.approvalAmount,
            installmentCount: m.installmentCount,
            createdAt: m.createdAt,
            ...money,
        };
    });

    const overall = await exports.getCollectionsSummary(userId, query);

    return {
        summary: overall.summary,
        mandates: rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

/**
 * One mandate: totals + each installment money status.
 */
exports.getMandateCollections = async (userId, mandateId) => {
    const local = await exports.resolveMandate(mandateId, { userId });

    const installments = await Installment.find({
        deleted: { $ne: true },
        $or: [
            { mandate: local._id },
            ...(local.rocketpayId
                ? [{ rocketpayMandateId: String(local.rocketpayId) }]
                : []),
        ],
    })
        .sort({ dueDate: 1, createdAt: 1 })
        .lean();

    let bucket = {
        expected: emptyMoneyBucket(),
        received: emptyMoneyBucket(),
        settled: emptyMoneyBucket(),
        pending: emptyMoneyBucket(),
        failed: emptyMoneyBucket(),
        terminated: emptyMoneyBucket(),
        total: emptyMoneyBucket(),
    };

    const items = installments.map((inst) => {
        const flags = classifyInstallmentMoney(inst.state, inst.amount);
        bucket = accumulateMoney(bucket, flags);
        return {
            id: inst._id,
            rocketpayId: inst.rocketpayId,
            state: inst.state,
            amount: Number(inst.amount) || 0,
            dueDate: inst.dueDate,
            scheduleDate: inst.scheduleDate,
            expected: flags.isExpected,
            received: flags.isReceived,
            settled: flags.isSettled,
            pending: flags.isPending,
            failed: flags.isFailed,
        };
    });

    return {
        mandate: {
            id: local._id,
            rocketpayId: local.rocketpayId,
            customerName: local.customerName,
            customerMobile: local.customerMobile,
            state: local.state,
            frequency: local.frequency,
            approvalAmount: local.approvalAmount,
            installmentCount: local.installmentCount,
        },
        summary: finalizeMoneySummary(bucket),
        installments: items,
    };
};
