const mongoose = require("mongoose");
const DlcKey = require("./model");
const gateway = require("./gateway");
const feeService = require("./fee.service");
const UserProfile = require("../user/profile.model");
const { formatCatalogue, formatDlcKey, formatCoinWallet, formatUnlockCode, formatDlcCustomer } = require("./mapper");
const ApiError = require("../../../utils/ApiError");
const { MDM_TYPE, CONTROLS, CONTROL_ACTIONS } = require("./constants");

const isObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value) &&
    String(new mongoose.Types.ObjectId(value)) === String(value);

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const attachMerchantNames = async (docs) => {
    const userIds = docs
        .map((d) => d.user?._id || d.user)
        .filter(Boolean)
        .map((id) => String(id));
    if (!userIds.length) return docs;

    const profiles = await UserProfile.find({
        user: { $in: [...new Set(userIds)] },
    }).select("user firstName lastName");

    const byUser = new Map(
        profiles.map((p) => [
            String(p.user),
            [p.firstName, p.lastName].filter(Boolean).join(" ").trim(),
        ])
    );

    for (const doc of docs) {
        const uid = doc.user?._id || doc.user;
        if (!uid) continue;
        const name = byUser.get(String(uid));
        if (!name) continue;
        if (doc.user && typeof doc.user === "object" && doc.user._id) {
            doc.user.fullName = name;
            if (typeof doc.user.set === "function") {
                doc.user.set("fullName", name, { strict: false });
            } else {
                doc.user.fullName = name;
            }
        }
    }
    return docs;
};

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

    // Never wipe merchant link on recon/refresh
    if (userId && !existing?.user) {
        set.user = userId;
    } else if (existing?.user && set.user === undefined) {
        // keep existing user — do not $unset
    }
    if (existing?.merchantName && set.merchantName == null) {
        set.merchantName = existing.merchantName;
    }
    if (existing?.merchantMobile && set.merchantMobile == null) {
        set.merchantMobile = existing.merchantMobile;
    }
    if (existing?.customerName && !set.customerName) {
        set.customerName = existing.customerName;
    }
    if (existing?.customerMobile && !set.customerMobile) {
        set.customerMobile = existing.customerMobile;
    }

    const setOnInsert = {};
    if (!existing && !userId && set.user === undefined) {
        setOnInsert.user = null;
    }

    const filter = existing
        ? { _id: existing._id }
        : keyId
          ? { rocketpayKeyId: String(keyId) }
          : { rocketpaySuperKeyId: String(superKey.id) };

    const update = { $set: set };
    if (Object.keys(setOnInsert).length) {
        update.$setOnInsert = setOnInsert;
    }

    return DlcKey.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
    });
};

const buildMerchantSnapshot = async (userId) => {
    if (!userId) return { merchantName: null, merchantMobile: null };
    const User = require("../user/model");
    const user = await User.findById(userId).select("mobile email");
    const profile = await UserProfile.findOne({ user: userId }).select(
        "firstName lastName"
    );
    const name = profile
        ? [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim()
        : "";
    return {
        merchantName: name || null,
        merchantMobile: user?.mobile || null,
    };
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

        const merchantSnap = await buildMerchantSnapshot(userId);

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
                merchantName: merchantSnap.merchantName,
                merchantMobile: merchantSnap.merchantMobile,
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
    if (query.locked === "true" || query.locked === "1") filter.isLocked = true;
    if (query.locked === "false" || query.locked === "0") filter.isLocked = false;
    if (query.customerMobile) {
        const mobile = String(query.customerMobile).trim();
        filter.customerMobile = new RegExp(
            digitsOnly(mobile) || mobile,
            "i"
        );
    }
    if (query.search) {
        const q = String(query.search).trim();
        filter.$or = [
            { imeiNo: new RegExp(q, "i") },
            { imeiNo2: new RegExp(q, "i") },
            { customerMobile: new RegExp(q, "i") },
            { customerName: new RegExp(q, "i") },
            { rocketpayKeyId: new RegExp(q, "i") },
            { manufacturer: new RegExp(q, "i") },
            { model: new RegExp(q, "i") },
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

/**
 * Merchant's DLC customers — one row per customer mobile.
 * App "Customers" screen: kis pe DLC lagaya.
 */
exports.listMyCustomers = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const match = {
        user: new mongoose.Types.ObjectId(userId),
        customerMobile: { $nin: [null, ""] },
    };

    if (query.locked === "true" || query.locked === "1") {
        match.isLocked = true;
    }
    if (query.search) {
        const q = String(query.search).trim();
        match.$or = [
            { customerMobile: new RegExp(q, "i") },
            { customerName: new RegExp(q, "i") },
            { imeiNo: new RegExp(q, "i") },
            { manufacturer: new RegExp(q, "i") },
            { model: new RegExp(q, "i") },
        ];
    }

    const [facet] = await DlcKey.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: "$customerMobile",
                customerName: { $first: "$customerName" },
                customerMobile: { $first: "$customerMobile" },
                deviceCount: { $sum: 1 },
                lockedCount: {
                    $sum: { $cond: [{ $eq: ["$isLocked", true] }, 1, 0] },
                },
                activeCount: {
                    $sum: {
                        $cond: [
                            {
                                $in: [
                                    { $toUpper: { $ifNull: ["$status", ""] } },
                                    ["ACTIVE", "PENDING", "REGISTERED"],
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
                latestStatus: { $first: "$status" },
                latestKeyId: { $first: "$_id" },
                latestImei: { $first: "$imeiNo" },
                latestManufacturer: { $first: "$manufacturer" },
                latestModel: { $first: "$model" },
                lastRegisteredAt: { $first: "$createdAt" },
            },
        },
        { $sort: { lastRegisteredAt: -1 } },
        {
            $facet: {
                items: [{ $skip: skip }, { $limit: limit }],
                totalCount: [{ $count: "count" }],
            },
        },
    ]);

    const items = facet?.items || [];
    const total = facet?.totalCount?.[0]?.count || 0;

    return {
        customers: items.map((row) =>
            formatDlcCustomer({
                id: digitsOnly(row.customerMobile) || row.customerMobile,
                customerName: row.customerName,
                customerMobile: row.customerMobile,
                deviceCount: row.deviceCount,
                lockedCount: row.lockedCount,
                activeCount: row.activeCount,
                latestStatus: row.latestStatus,
                latestKeyId: row.latestKeyId,
                latestImei: row.latestImei,
                latestDevice: [row.latestManufacturer, row.latestModel]
                    .filter(Boolean)
                    .join(" "),
                lastRegisteredAt: row.lastRegisteredAt,
            })
        ),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
};

/**
 * One customer detail for merchant — profile + all DLC devices.
 * `mobile` can be +91… or digits; `id` can be DLC key id to resolve customer.
 */
exports.getMyCustomer = async (userId, query = {}) => {
    const filter = { user: userId };
    let mobile = query.mobile ? String(query.mobile).trim() : "";

    if (!mobile && query.id) {
        const key = await exports.resolveDlcKey(query.id, { userId });
        mobile = key.customerMobile || "";
        if (!mobile) {
            return {
                customer: {
                    name: key.customerName || null,
                    mobile: null,
                },
                devices: [formatDlcKey(key)],
                summary: {
                    deviceCount: 1,
                    lockedCount: key.isLocked ? 1 : 0,
                },
            };
        }
    }

    if (!mobile) {
        throw new ApiError(400, "mobile or id is required");
    }

    const digits = digitsOnly(mobile);
    filter.$or = [
        { customerMobile: mobile },
        ...(digits
            ? [{ customerMobile: new RegExp(`${digits}$`) }]
            : []),
    ];

    const devices = await DlcKey.find(filter).sort({ createdAt: -1 });
    if (!devices.length) {
        throw new ApiError(404, "DLC customer not found");
    }

    const first = devices[0];
    return {
        customer: {
            name: first.customerName || null,
            mobile: first.customerMobile || null,
        },
        devices: devices.map(formatDlcKey),
        summary: {
            deviceCount: devices.length,
            lockedCount: devices.filter((d) => d.isLocked).length,
            activeCount: devices.filter((d) =>
                ["ACTIVE", "PENDING", "REGISTERED"].includes(
                    String(d.status || "").toUpperCase()
                )
            ).length,
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

const resolveMerchantContact = async (local, userId = null) => {
    let name = String(local?.merchantName || "").trim() || null;
    let mobile = String(local?.merchantMobile || "").trim() || null;

    const merchantUserId = local?.user || userId || null;
    if ((!name || !mobile) && merchantUserId) {
        const snap = await buildMerchantSnapshot(merchantUserId);
        name = name || snap.merchantName;
        mobile = mobile || snap.merchantMobile;
    }

    return { merchantName: name, merchantMobile: mobile };
};

const buildOptionalMessageBody = (body = {}, merchant = {}) => {
    const title = String(
        body.title || merchant.merchantName || ""
    ).trim();
    const message = String(
        body.message || merchant.merchantMobile || ""
    ).trim();
    const payload = {};
    if (title) payload.title = title;
    if (message) payload.message = message;
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
        const merchant = await resolveMerchantContact(local, userId);
        payload = buildOptionalMessageBody(body, merchant);
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

const STALE_SYNC_MS = 15 * 60 * 1000;
const MAX_STALE_REFRESH = 8;

const refreshLocalKeyFromRocketPay = async (local) => {
    if (!local?.rocketpayKeyId) return local;
    let key;
    try {
        key = await gateway.refreshKey(local.rocketpayKeyId);
    } catch (_err) {
        key = await gateway.getKey(local.rocketpayKeyId);
    }
    return persistFromRocketPay({
        userId: local.user || null,
        key,
        source: local.source === "RECON" ? "RECON" : "SYSTEM",
    });
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
        const User = require("../user/model");
        const merchants = await User.find({
            mobile: { $regex: q, $options: "i" },
            isDeleted: { $ne: true },
        })
            .select("_id")
            .limit(50);
        filter.$or = [
            { imeiNo: new RegExp(q, "i") },
            { imeiNo2: new RegExp(q, "i") },
            { customerMobile: new RegExp(q, "i") },
            { customerName: new RegExp(q, "i") },
            { rocketpayKeyId: new RegExp(q, "i") },
            ...(merchants.length
                ? [{ user: { $in: merchants.map((u) => u._id) } }]
                : []),
        ];
    }

    // First open / empty DB: one auto recon so admin need not sync manually every time
    const autoSync =
        query.autoSync === "true" ||
        query.autoSync === "1" ||
        query.autoSync === undefined ||
        query.autoSync === "";
    if (autoSync) {
        const totalAll = await DlcKey.countDocuments({});
        if (totalAll === 0) {
            try {
                await exports.reconKeys();
            } catch (err) {
                console.error("[DLC] auto recon on empty DB failed:", err.message);
            }
        }
    }

    let [items, total] = await Promise.all([
        DlcKey.find(filter)
            .populate("user", "mobile email status")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        DlcKey.countDocuments(filter),
    ]);

    // Soft-refresh stale rows on this page (status/lock) — no full RocketPay list sync
    const refreshStale =
        query.refreshStale !== "false" && query.refreshStale !== "0";
    if (refreshStale && items.length) {
        const now = Date.now();
        const stale = items
            .filter((doc) => {
                if (!doc.rocketpayKeyId) return false;
                if (!doc.lastSyncedAt) return true;
                return now - new Date(doc.lastSyncedAt).getTime() > STALE_SYNC_MS;
            })
            .slice(0, MAX_STALE_REFRESH);

        if (stale.length) {
            await Promise.all(
                stale.map(async (doc) => {
                    try {
                        await refreshLocalKeyFromRocketPay(doc);
                    } catch (err) {
                        console.error(
                            "[DLC] stale refresh failed:",
                            doc.rocketpayKeyId,
                            err.message
                        );
                    }
                })
            );
            items = await DlcKey.find(filter)
                .populate("user", "mobile email status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
        }
    }

    await attachMerchantNames(items);

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
    await attachMerchantNames([local]);
    return { key: formatDlcKey(local) };
};

exports.adminRefreshKey = async (id) => {
    const local = await exports.resolveDlcKey(id);
    return exports.refreshKey(local.user || null, id);
};

exports.adminUnregisterKey = async (id) => {
    const local = await exports.resolveDlcKey(id);
    if (!local.user) {
        const keyId = requireKeyId(local);
        const data = await gateway.unregisterKey(keyId);
        const doc = await persistFromRocketPay({
            userId: null,
            key: null,
            defaults: {
                rocketpayKeyId: keyId,
                isDeleted: true,
                keyStatus: "FINISHED",
                status: "FINISHED",
            },
            source: "ADMIN",
        });
        return { key: formatDlcKey(doc), rocketpay: data };
    }
    return exports.unregisterKey(local.user, id);
};

exports.adminLockKey = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.lockKey(local.user || null, id, body);
};

exports.adminUnlockKey = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.unlockKey(local.user || null, id, body);
};

exports.getCoinWallet = async () => {
    const data = await gateway.getCoinWallet();
    return { wallet: formatCoinWallet(data), rocketpay: data };
};

/**
 * Link Unassigned DLC key to CredAxis merchant (user who applied DLC).
 * Body: { userId } OR { mobile }
 */
exports.assignMerchant = async (id, body = {}) => {
    const local = await exports.resolveDlcKey(id);
    const User = require("../user/model");

    let user = null;
    if (body.userId && isObjectId(body.userId)) {
        user = await User.findById(body.userId);
    } else if (body.mobile) {
        const digits = digitsOnly(body.mobile);
        user = await User.findOne({
            isDeleted: { $ne: true },
            $or: [
                { mobile: String(body.mobile).trim() },
                ...(digits ? [{ mobile: new RegExp(`${digits}$`) }] : []),
            ],
        });
    }

    if (!user || user.isDeleted) {
        throw new ApiError(404, "Merchant user not found");
    }

    const snap = await buildMerchantSnapshot(user._id);
    local.user = user._id;
    local.merchantName = snap.merchantName;
    local.merchantMobile = snap.merchantMobile;
    await local.save();
    await local.populate("user", "mobile email status");
    await attachMerchantNames([local]);
    return { key: formatDlcKey(local) };
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
    return exports.sendTextReminder(local.user || null, id, body);
};

exports.adminSendFullScreenReminder = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.sendFullScreenReminder(local.user || null, id, body);
};

exports.adminFetchUnlockCode = async (id, body) => {
    const local = await exports.resolveDlcKey(id);
    return exports.fetchUnlockCode(local.user || null, id, body);
};

exports.adminListActions = async (id) => {
    const local = await exports.resolveDlcKey(id);
    return exports.listActions(local.user || null, id);
};

exports.adminGetControls = async (id) => {
    const local = await exports.resolveDlcKey(id);
    return exports.getControls(local.user || null, id);
};
