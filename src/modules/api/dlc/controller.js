const dlcService = require("./service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

const omitRocketPay = (data) => {
    if (!data || typeof data !== "object") return data;
    const { rocketpay, control, ...rest } = data;
    if (data.unlock) {
        return { ...rest, unlock: data.unlock };
    }
    return rest;
};

exports.getFee = asyncHandler(async (_req, res) => {
    const data = await dlcService.getFeeQuote();
    return response.success(res, "DLC create fee fetched", data);
});

exports.getCatalogue = asyncHandler(async (req, res) => {
    const data = await dlcService.getCatalogue(req.query.imei);
    return response.success(res, "Device catalogue fetched", {
        catalogue: data.catalogue,
    });
});

exports.createKey = asyncHandler(async (req, res) => {
    const data = await dlcService.createKey(req.user.id, req.body);
    return response.success(
        res,
        "DLC key created successfully",
        omitRocketPay(data),
        201
    );
});

exports.listKeys = asyncHandler(async (req, res) => {
    const data = await dlcService.listMyKeys(req.user.id, req.query);
    return response.success(res, "DLC keys fetched successfully", data);
});

exports.listCustomers = asyncHandler(async (req, res) => {
    const data = await dlcService.listMyCustomers(req.user.id, req.query);
    return response.success(res, "DLC customers fetched successfully", data);
});

exports.getCustomer = asyncHandler(async (req, res) => {
    const data = await dlcService.getMyCustomer(req.user.id, {
        mobile: req.query.mobile || req.params.mobile,
        id: req.query.id || req.params.id,
    });
    return response.success(res, "DLC customer fetched successfully", data);
});

exports.getKey = asyncHandler(async (req, res) => {
    const refresh =
        req.query.refresh === "true" || req.query.refresh === "1";
    const data = await dlcService.getKey(req.user.id, req.params.id, {
        refresh,
    });
    return response.success(res, "DLC key fetched successfully", omitRocketPay(data));
});

exports.refreshKey = asyncHandler(async (req, res) => {
    const data = await dlcService.refreshKey(req.user.id, req.params.id);
    return response.success(res, "DLC key refreshed successfully", omitRocketPay(data));
});

exports.unregisterKey = asyncHandler(async (req, res) => {
    const data = await dlcService.unregisterKey(req.user.id, req.params.id);
    return response.success(res, "DLC key unregistered successfully", omitRocketPay(data));
});

exports.lockKey = asyncHandler(async (req, res) => {
    const data = await dlcService.lockKey(
        req.user.id,
        req.params.id,
        req.body || {}
    );
    return response.success(res, "Device lock requested", omitRocketPay(data));
});

exports.unlockKey = asyncHandler(async (req, res) => {
    const data = await dlcService.unlockKey(
        req.user.id,
        req.params.id,
        req.body || {}
    );
    return response.success(res, "Device unlock requested", omitRocketPay(data));
});

exports.sendTextReminder = asyncHandler(async (req, res) => {
    const data = await dlcService.sendTextReminder(
        req.user.id,
        req.params.id,
        req.body || {}
    );
    return response.success(res, "Text reminder sent", omitRocketPay(data));
});

exports.sendFullScreenReminder = asyncHandler(async (req, res) => {
    const data = await dlcService.sendFullScreenReminder(
        req.user.id,
        req.params.id,
        req.body || {}
    );
    return response.success(res, "Full-screen reminder sent", omitRocketPay(data));
});

exports.fetchUnlockCode = asyncHandler(async (req, res) => {
    const data = await dlcService.fetchUnlockCode(
        req.user.id,
        req.params.id,
        req.body || {}
    );
    return response.success(res, "Unlock code fetched", omitRocketPay(data));
});

exports.listActions = asyncHandler(async (req, res) => {
    const data = await dlcService.listActions(req.user.id, req.params.id);
    return response.success(res, "DLC actions fetched", {
        actions: data.actions,
    });
});

exports.getControls = asyncHandler(async (req, res) => {
    const data = await dlcService.getControls(req.user.id, req.params.id);
    return response.success(res, "DLC controls fetched", {
        controls: data.controls,
    });
});
