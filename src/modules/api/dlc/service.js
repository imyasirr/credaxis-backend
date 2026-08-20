const mongoose = require("mongoose");
const DlcKey = require("./model");
const gateway = require("./gateway");
const feeService = require("./fee.service");
const { formatCatalogue, formatDlcKey, formatCoinWallet, formatUnlockCode } = require("./mapper");
const ApiError = require("../../../utils/ApiError");
const { MDM_TYPE, CONTROLS, CONTROL_ACTIONS } = require("./constants");

const isObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value) &&
    String(new mongoose.Types.ObjectId(value)) === String(value);

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const normalizeMobile = (mobile) => {
    const raw = String(mobile || "").trim();
    if (!raw) return null;
    if (raw.startsWith("+")) return raw;
    const digits = digitsOnly(raw);
    if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
    return raw;
};

const applySuperKey = (set, superKey) => {
    if (!superKey || !superKey.id) return set;
    set.rocketpaySuperKeyId = String(superKey.id);
    set.rocketpayKeyId = superKey.key_id ? String(superKey.key_id) : set.rocketpayKeyId;
    set.customerName = superKey.name || set.customerName;
    set.customerMobile = superKey.mobile_number || set.customerMobile;
    set.status = superKey.status || set.status;
    set.keyStatus = superKey.key_status || set.keyStatus;
    set.isConsentGiven = Boolean(superKey.is_consent_given);
    set.isDeleted = Boolean(superKey.is_deleted);
    set.collectionInfo = superKey.collection_info || set.collectionInfo;
    set.meta = superKey.meta || set.meta;
    set.rawSuperKey = superKey;
    return set;
};

const applyKeyEntity = (set, key) => {
    if (!key || !key.id) return set;
    set.rocketpayKeyId = String(key.id);
    set.status = key.status || set.status;
    set.isLocked = Boolean(key.is_locked);
    set.isDeleted = Boolean(key.is_deleted);
    set.enrolledDeviceImei = key.enrolled_device_imei || set.enrolledDeviceImei;
    set.journey = Array.isArray(key.journey) ? key.journey : set.journey;
    set.deviceInfo = key.device_info || set.deviceInfo;
    if (key.device_info) {
        set.manufacturer = key.device_info.manufacturer || set.manufacturer;
        set.model = key.device_info.model || set.model;
        set.imeiNo = key.device_info.imei_no || set.imeiNo;
        set.imeiNo2 = key.device_info.imei_no2 || set.imeiNo2;
        set.mdmType = key.device_info.mdm_type || set.mdmType;
    }
    set.rawKey = key;
    return set;
};

const persistFromRocketPay = async ({
    userId,
    superKey = null,
    key = null,
    defaults = {},
    source = "API",
}) => {
    const keyId =
        (key && key.id) ||
        (superKey && superKey.key_id) ||
        defaults.rocketpayKeyId ||
        null;
    const existing = keyId
        ? await DlcKey.findOne({ rocketpayKeyId: String(keyId) })
        : superKey?.id
          ? await DlcKey.findOne({ rocketpaySuperKeyId: String(superKey.id) })
          : null;

    const set = {
        lastSyncedAt: new Date(),
        source,
        ...defaults,
    };
    applySuperKey(set, superKey);
    applyKeyEntity(set, key);
    if (userId && !existing?.user) {
        set.user = userId;
    }

    const filter = existing
        ? { _id: existing._id }
        : keyId
          ? { rocketpayKeyId: String(keyId) }
          : { rocketpaySuperKeyId: String(superKey.id) };

    return DlcKey.findOneAndUpdate(
        filter,
        { $set: set },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
};

const requireKeyId = (local) => {
    if (!local?.rocketpayKeyId) {
        throw new ApiError(400, "RocketPay key id is missing for this device");
    }
    return local.rocketpayKeyId;
};

exports.resolveDlcKey = async (idOrRpId, { userId = null } = {}) => {
    const filter = isObjectId(idOrRpId)
        ? {
              $or: [
                  { _id: idOrRpId },
                  { rocketpayKeyId: String(idOrRpId) },
                  { rocketpaySuperKeyId: String(idOrRpId) },
              ],
          }
        : {
              $or: [
                  { rocketpayKeyId: String(idOrRpId) },
                  { rocketpaySuperKeyId: String(idOrRpId) },
              ],
          };

    if (userId) filter.user = userId;

    const doc = await DlcKey.findOne(filter);
    if (!doc) {
        throw new ApiError(404, "DLC device not found");
    }
    return doc;
};

exports.getFeeQuote = async () => feeService.getDlcCreateFeeSetting();

exports.getCatalogue = async (imei) => {
    const clean = digitsOnly(imei);
    if (!/^\d{14,16}$/.test(clean)) {
        throw new ApiError(400, "IMEI must be 14-16 digits");
    }
    const data = await gateway.getDeviceCatalogue(clean);
    const catalogue = formatCatalogue(data);
    if (!catalogue) {
        throw new ApiError(502, "Device catalogue response was empty");
    }
    return { catalogue, rocketpay: data };
};

exports.createKey = async (userId, body) => {
    const imeiNo = digitsOnly(body.device_info?.imei_no || body.imei_no);
    const imeiNo2 = digitsOnly(body.device_info?.imei_no2 || body.imei_no2);
    const manufacturer = String(
        body.device_info?.manufacturer || body.manufacturer || ""
    ).trim();
    const model = String(body.device_info?.model || body.model || "").trim();
    const name = String(body.name || body.customer?.name || "").trim();
    const mobile = normalizeMobile(
        body.mobile_number || body.customer?.mobile_number
    );

    if (!/^\d{14,16}$/.test(imeiNo)) {
        throw new ApiError(400, "device_info.imei_no must be 14-16 digits");
    }
    if (!manufacturer || !model) {
        throw new ApiError(400, "device_info.manufacturer and model are required");
    }
    if (!name) {
        throw new ApiError(400, "Customer name is required");
    }
    if (!mobile) {
        throw new ApiError(400, "Customer mobile_number is required");
    }

    const existing = await DlcKey.findOne({
        $or: [
            { imeiNo },
            { imeiNo2: imeiNo },
            ...(imeiNo2 ? [{ imeiNo: imeiNo2 }, { imeiNo2 }] : []),
        ],
    });
    if (existing) {
        throw new ApiError(
            400,
            "This IMEI is already registered. A released device cannot be enrolled again via DLC."
        );
    }

    const catalogueData = await gateway.getDeviceCatalogue(imeiNo);
    const catalogue = formatCatalogue(catalogueData);
    if (!catalogue?.eligible) {
        throw new ApiError(
            400,
            `Device is not eligible for DLC enrolment (catalogue state: ${catalogue?.state || "UNKNOWN"}). Only APPROVED devices can be registered.`
        );
    }

    const fee = await feeService.getDlcCreateFeeSetting();
    let walletDebit = null;

    try {
        if (fee.paymentRequired) {
            const walletService = require("../wallet/service");
            walletDebit = await walletService.debitMoney(userId, {
                amount: fee.amount,
                description: "DLC Superkey create fee",
                notify: true,
            });
        }

        const superKey = await gateway.createOnlyKey({
            name,
            mobile_number: mobile,
            device_info: {
                manufacturer,
                model,
                imei_no: imeiNo,
                imei_no2: imeiNo2 || imeiNo,
                mdm_type: MDM_TYPE,
            },
        });

        let key = null;
        if (superKey?.key_id) {
            try {
                key = await gateway.getKey(superKey.key_id);
            } catch (_err) {
                key = null;
            }
        }

        const doc = await persistFromRocketPay({
            userId,
            superKey,
            key,
            defaults: {
                customerName: name,
                customerMobile: mobile,
                manufacturer,
                model,
                imeiNo,
                imeiNo2: imeiNo2 || null,
                mdmType: MDM_TYPE,
                feeAmount: fee.paymentRequired ? fee.amount : 0,
                walletTransactionId:
                    walletDebit?.transaction?.transactionId ||
                    walletDebit?.transactionDoc?.transactionId ||
                    null,
            },
            source: "API",
        });

        return {
            key: formatDlcKey(doc),
            catalogue,
            fees: fee,
            wallet: walletDebit?.wallet || null,
            rocketpay: superKey,
        };
    } catch (error) {
        if (walletDebit && fee.paymentRequired) {
            try {
                const walletService = require("../wallet/service");
                await walletService.creditMoney(userId, {
                    amount: fee.amount,
                    description: "DLC Superkey create fee refund",
                    notify: true,
                });
            } catch (refundErr) {
                console.error(
                    "[DLC] wallet refund failed:",
                    refundErr.message
                );
            }
        }
        throw error;
    }
};

exports.listMyKeys = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = { user: userId };
    if (query.status) filter.status = String(query.status).toUpperCase();
    if (query.search) {
        const q = String(query.search).trim();
        filter.$or = [
            { imeiNo: new RegExp(q, "i") },
            { imeiNo2: new RegExp(q, "i") },
            { customerMobile: new RegExp(q, "i") },
            { customerName: new RegExp(q, "i") },
            { rocketpayKeyId: new RegExp(q, "i") },
        ];
    }

    const [items, total] = await Promise.all([
        DlcKey.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        DlcKey.countDocuments(filter),
    ]);

    return {
        keys: items.map(formatDlcKey),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getKey = async (userId, id, { refresh = false } = {}) => {
    const local = await exports.resolveDlcKey(id, { userId });
    if (!refresh) {
        return { key: formatDlcKey(local) };
    }
    return exports.refreshKey(userId, id);
};

exports.refreshKey = async (userId, id) => {
    const local = await exports.resolveDlcKey(id, { userId });
    const keyId = requireKeyId(local);
    let key;
    try {
        key = await gateway.refreshKey(keyId);
    } catch (_err) {
        key = await gateway.getKey(keyId);
    }
    const doc = await persistFromRocketPay({
        userId,
        key,
        defaults: {},
        source: "API",
    });
    return { key: formatDlcKey(doc), rocketpay: key };
};

exports.unregisterKey = async (userId, id) => {
    const local = await exports.resolveDlcKey(id, { userId });
    const keyId = requireKeyId(local);
    const data = await gateway.unregisterKey(keyId);
    let key = null;
    try {
        key = await gateway.refreshKey(keyId);
    } catch (_err) {
        key = null;
    }
    const doc = await persistFromRocketPay({
        userId,
        key,
        defaults: {
            isDeleted: true,
            keyStatus: "FINISHED",
            status: key?.status || "FINISHED",
        },
        source: "API",
    });
    return { key: formatDlcKey(doc), rocketpay: data };
};

const applyLockAction = async (userId, id, actionName, body = {}) => {
    return applyControlAction(userId, id, CONTROLS.LOCK, actionName, body, {
        refreshAfter: true,
    });
};

const buildOptionalMessageBody = (body = {}) => {
    const payload = {};
    if (body.title) payload.title = String(body.title).trim();
    if (body.message) payload.message = String(body.message).trim();
    return Object.keys(payload).length ? payload : null;
};

const applyControlAction = async (
    userId,
    id,
    controlName,
    actionName,
    body = {},
    { refreshAfter = false } = {}
) => {
    const local = await exports.resolveDlcKey(id, { userId });
    const keyId = requireKeyId(local);
    let payload = null;

    if (controlName === CONTROLS.UNLOCK_CODE && actionName === CONTROL_ACTIONS.FETCH) {
        const code = String(body.code || "").trim();
        if (!code) {
            throw new ApiError(
                400,
                "code is required (challenge value shown on the device MDM app)"
            );
        }
        payload = { code };
    } else {
        payload = buildOptionalMessageBody(body);
    }

    const data = await gateway.applyControl(
        keyId,
        controlName,
        actionName,
        payload
    );

    if (controlName === CONTROLS.UNLOCK_CODE && actionName === CONTROL_ACTIONS.FETCH) {
        return {
            unlock: formatUnlockCode(data),
            control: data,
        };
    }

    if (refreshAfter) {
        const refreshed = await exports.refreshKey(userId, id);
        return { ...refreshed, control: data };
    }

    return { control: data };
};

exports.lockKey = (userId, id, body) =>
    applyLockAction(userId, id, CONTROL_ACTIONS.LOCK, body);

exports.unlockKey = (userId, id, body) =>
    applyLockAction(userId, id, CONTROL_ACTIONS.UNLOCK, body);

exports.sendTextReminder = (userId, id, body) =>
    applyControlAction(
        userId,
        id,
        CONTROLS.TEXT_REMINDER,
        CONTROL_ACTIONS.SEND,
        body
    );

exports.sendFullScreenReminder = (userId, id, body) =>
    applyControlAction(
        userId,
        id,
        CONTROLS.FULL_SCREEN_REMINDER,
        CONTROL_ACTIONS.SEND,
        body
    );

exports.fetchUnlockCode = (userId, id, body) =>
    applyControlAction(
        userId,
        id,
        CONTROLS.UNLOCK_CODE,
        CONTROL_ACTIONS.FETCH,
        body
    );

exports.listActions = async (userId, id) => {
    const local = await exports.resolveDlcKey(id, { userId });
    const keyId = requireKeyId(local);
    const data = await gateway.listActions(keyId);
    const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];
    return { actions: items, rocketpay: data };
};

exports.getControls = async (userId, id) => {
    const local = await exports.resolveDlcKey(id, { userId });
    const keyId = requireKeyId(local);
    const data = await gateway.refreshControls(keyId);
    return { controls: data, rocketpay: data };
};

exports.listAdminKeys = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const filter = {};
    if (query.userId && isObjectId(query.userId)) filter.user = query.userId;
    if (query.status) filter.status = String(query.status).toUpperCase();
    if (query.locked === "true" || query.locked === "1") filter.isLocked = true;
    if (query.locked === "false" || query.locked === "0") filter.isLocked = false;
    if (query.search) {
        const q = String(query.search).trim();
        filter.$or = [
            { imeiNo: new RegExp(q, "i") },
            { imeiNo2: new RegExp(q, "i") },
            { customerMobile: new RegExp(q, "i") },
            { customerName: new RegExp(q, "i") },
            { rocketpayKeyId: new RegExp(q, "i") },
        ];
    }

    const [items, total] = await Promise.all([
        DlcKey.find(filter)
            .populate("user", "mobile email status")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        DlcKey.countDocuments(filter),
    ]);

    return {
        keys: items.map(formatDlcKey),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

exports.getAdminKey = async (id, { refresh = false } = {}) => {
    const local = await exports.resolveDlcKey(id);
    if (refresh && local.rocketpayKeyId) {
        return exports.adminRefreshKey(id);
    }
    await local.populate("user", "mobile email status");
    return { key: formatDlcKey(local) };
};

exports.adminRefreshKey = async (id) => {
    const local = await exports.resolveDlcKey(id);
    return exports.refreshKey(local.user, id);
};

exports.adminUnregisterKey = async (id) => {
    const local = await exports.resolveDlcKey(id);
    return exports.unregisterKey(local.user, id);
};

exports.adminLockKey = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.lockKey(local.user, id, body);
};

exports.adminUnlockKey = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.unlockKey(local.user, id, body);
};

exports.getCoinWallet = async () => {
    const data = await gateway.getCoinWallet();
    return { wallet: formatCoinWallet(data), rocketpay: data };
};

exports.reconKeys = async () => {
    const data = await gateway.listSuperKeys();
    const items = Array.isArray(data?.items) ? data.items : [];
    let synced = 0;
    let failed = 0;

    for (const superKey of items) {
        if (!superKey?.id) continue;
        try {
            let key = null;
            if (superKey.key_id) {
                try {
                    key = await gateway.getKey(superKey.key_id);
                } catch (_err) {
                    key = null;
                }
            }
            const existing = superKey.key_id
                ? await DlcKey.findOne({
                      rocketpayKeyId: String(superKey.key_id),
                  })
                : await DlcKey.findOne({
                      rocketpaySuperKeyId: String(superKey.id),
                  });

            await persistFromRocketPay({
                userId: existing?.user || null,
                superKey,
                key,
                source: "RECON",
            });
            synced += 1;
        } catch (err) {
            failed += 1;
            console.error("[DLC] recon item failed:", err.message);
        }
    }

    return {
        synced,
        failed,
        total: items.length,
        count: data?.count ?? items.length,
        returned: data?.returned ?? items.length,
    };
};

exports.adminSendTextReminder = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.sendTextReminder(local.user, id, body);
};

exports.adminSendFullScreenReminder = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.sendFullScreenReminder(local.user, id, body);
};

exports.adminFetchUnlockCode = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.fetchUnlockCode(local.user, id, body);
};

exports.adminListActions = async (id) => {
    const local = await exports.resolveDlcKey(id);
    return exports.listActions(local.user, id);
};

exports.adminGetControls = async (id) => {
    const local = await exports.resolveDlcKey(id);
    return exports.getControls(local.user, id);
};
