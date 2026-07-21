const coinTransferService = require("../coins/transfer.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.createTransfer = asyncHandler(async (req, res) => {
    const data = await coinTransferService.createTransfer(
        req.user.id,
        req.body
    );
    return response.success(res, "Coins transferred successfully", data, 201);
});

exports.getTransfers = asyncHandler(async (req, res) => {
    const data = await coinTransferService.getTransfers(req.query);
    return response.success(res, "Coin transfers fetched successfully", data);
});

exports.getTransferById = asyncHandler(async (req, res) => {
    const data = await coinTransferService.getTransferById(req.params.id);
    return response.success(res, "Coin transfer fetched successfully", data);
});

exports.getTransferReasons = asyncHandler(async (req, res) => {
    const { TRANSFER_REASONS } = require("../coins/transfer.model");
    const { REASON_LABELS } = require("../coins/transfer.mapper");

    return response.success(
        res,
        "Transfer reasons fetched",
        TRANSFER_REASONS.map((value) => ({
            value,
            label: REASON_LABELS[value] || value,
        }))
    );
});
