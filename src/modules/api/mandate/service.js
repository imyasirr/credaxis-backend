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

    // Only override payees when we have a RocketPay sub-account id for this distributor
    if (
        distributor.rocketpayAccountId &&
        (!Array.isArray(rpBody.payees) || rpBody.payees.length === 0)
    ) {
        rpBody.payees = [
            {
                account_id: distributor.rocketpayAccountId,
            },
        ];
    }

    return rpBody;
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
            if (
                fees.installmentFee.total > 0 &&
                metaFreq &&
                frequency &&
                metaFreq !== frequency
            ) {
                throw new ApiError(
                    400,
                    `Payment was for frequency ${metaFreq} but mandate is ${frequency}`
                );
            }
            if (
                fees.installmentFee.total > 0 &&
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
        return {
            installments: Array.isArray(synced)
                ? synced.map(formatInstallment)
                : [],
            rocketpay: data,
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
            return {
                installments: synced.map(formatInstallment),
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
