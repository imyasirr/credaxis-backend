const dlcClient = require("../../../integrations/rocketpay/rocketpay.dlc.client");
const ApiError = require("../../../utils/ApiError");

const isSuccessStatus = (code) => code >= 200 && code < 300;

const unwrapEntity = (payload) => {
    if (!payload || typeof payload !== "object") return payload;
    if (payload.id) return payload;
    if (payload.data && typeof payload.data === "object" && payload.data.id) {
        return payload.data;
    }
    return payload;
};

const extractErrorMessage = (data, fallback) => {
    if (!data) return fallback;
    if (typeof data === "string" && data.trim()) return data.trim();
    const message =
        data.message ||
        data.error_description ||
        data.error_message ||
        (typeof data.error === "string" ? data.error : null);
    if (message && String(message).trim()) {
        const code = data.errorCode || data.error_type;
        return code ? `${code}: ${message}` : String(message);
    }
    if (data.errorCode) return String(data.errorCode);
    return fallback;
};

const callDlc = async ({ apiName, invoke }) => {
    const result = await invoke();
    const statusCode = result.statusCode;
    const data = result.data;

    if (!isSuccessStatus(statusCode)) {
        // Never forward RocketPay 401/403 — admin axios treats 401 as logout.
        const clientStatus =
            statusCode === 401 || statusCode === 403
                ? 502
                : statusCode >= 400 && statusCode < 600
                  ? statusCode
                  : 502;
        throw new ApiError(
            clientStatus,
            extractErrorMessage(data, `RocketPay ${apiName} failed`)
        );
    }

    return data;
};

exports.getDeviceCatalogue = (imei) =>
    callDlc({
        apiName: "DLC_DEVICE_CATALOGUE",
        invoke: () => dlcClient.getDeviceCatalogue(imei),
    });

exports.createOnlyKey = (body) =>
    callDlc({
        apiName: "DLC_CREATE_ONLY_KEY",
        invoke: () => dlcClient.createOnlyKey(body),
    }).then(unwrapEntity);

exports.listSuperKeys = () =>
    callDlc({
        apiName: "DLC_LIST_SUPER_KEYS",
        invoke: () => dlcClient.listSuperKeys(),
    });

exports.getKey = (keyId) =>
    callDlc({
        apiName: "DLC_GET_KEY",
        invoke: () => dlcClient.getKey(keyId),
    }).then(unwrapEntity);

exports.refreshKey = (keyId) =>
    callDlc({
        apiName: "DLC_REFRESH_KEY",
        invoke: () => dlcClient.refreshKey(keyId),
    }).then(unwrapEntity);

exports.unregisterKey = (keyId) =>
    callDlc({
        apiName: "DLC_UNREGISTER_KEY",
        invoke: () => dlcClient.unregisterKey(keyId),
    });

exports.applyControl = (keyId, controlName, actionName, body = null) =>
    callDlc({
        apiName: `DLC_${controlName}_${actionName}`,
        invoke: () =>
            dlcClient.applyControl(keyId, controlName, actionName, body),
    });

exports.listActions = (keyId) =>
    callDlc({
        apiName: "DLC_LIST_ACTIONS",
        invoke: () => dlcClient.listActions(keyId),
    });

exports.refreshControls = (keyId) =>
    callDlc({
        apiName: "DLC_REFRESH_CONTROLS",
        invoke: () => dlcClient.refreshControls(keyId),
    });

exports.getCoinWallet = () =>
    callDlc({
        apiName: "DLC_COIN_WALLET",
        invoke: () => dlcClient.getCoinWallet(),
    });
