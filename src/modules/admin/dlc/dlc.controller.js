const dlcService = require("../../api/dlc/service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.listKeys = asyncHandler(async (req, res) => {
    const data = await dlcService.listAdminKeys(req.query);
    return response.success(res, "DLC keys fetched successfully", data);
});

exports.getKey = asyncHandler(async (req, res) => {
    const refresh =
        req.query.refresh === "true" || req.query.refresh === "1";
    const data = await dlcService.getAdminKey(req.params.id, { refresh });
    return response.success(res, "DLC key fetched successfully", data);
});

exports.refreshKey = asyncHandler(async (req, res) => {
    const data = await dlcService.adminRefreshKey(req.params.id);
    return response.success(res, "DLC key refreshed successfully", data);
});

exports.unregisterKey = asyncHandler(async (req, res) => {
    const data = await dlcService.adminUnregisterKey(req.params.id);
    return response.success(res, "DLC key unregistered successfully", data);
});

exports.lockKey = asyncHandler(async (req, res) => {
    const data = await dlcService.adminLockKey(req.params.id, req.body || {});
    return response.success(res, "Device lock requested", data);
});

exports.unlockKey = asyncHandler(async (req, res) => {
    const data = await dlcService.adminUnlockKey(req.params.id, req.body || {});
    return response.success(res, "Device unlock requested", data);
});

exports.sendTextReminder = asyncHandler(async (req, res) => {
    const data = await dlcService.adminSendTextReminder(
        req.params.id,
        req.body || {}
    );
    return response.success(res, "Text reminder sent", data);
});

exports.sendFullScreenReminder = asyncHandler(async (req, res) => {
    const data = await dlcService.adminSendFullScreenReminder(
        req.params.id,
        req.body || {}
    );
    return response.success(res, "Full-screen reminder sent", data);
});

exports.fetchUnlockCode = asyncHandler(async (req, res) => {
    const data = await dlcService.adminFetchUnlockCode(
        req.params.id,
        req.body || {}
    );
    return response.success(res, "Unlock code fetched", data);
});

exports.listActions = asyncHandler(async (req, res) => {
    const data = await dlcService.adminListActions(req.params.id);
    return response.success(res, "DLC actions fetched", data);
});

exports.getControls = asyncHandler(async (req, res) => {
    const data = await dlcService.adminGetControls(req.params.id);
    return response.success(res, "DLC controls fetched", data);
});

exports.reconKeys = asyncHandler(async (_req, res) => {
    const data = await dlcService.reconKeys();
    return response.success(res, "DLC keys reconciled from RocketPay", data);
});

exports.getCoinWallet = asyncHandler(async (_req, res) => {
    const data = await dlcService.getCoinWallet();
    return response.success(res, "RocketPay coin wallet fetched", data);
});

exports.assignMerchant = asyncHandler(async (req, res) => {
    const data = await dlcService.assignMerchant(req.params.id, req.body || {});
    return response.success(res, "Merchant assigned to DLC key", data);
});
