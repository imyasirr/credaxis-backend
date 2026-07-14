const tokenTransferService = require("../creditToken/tokenTransfer.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.createTransfer = asyncHandler(async (req, res) => {
    const data = await tokenTransferService.createTransfer(
        req.user.id,
        req.body
    );
    return response.success(res, "Tokens transferred successfully", data, 201);
});

exports.getTransfers = asyncHandler(async (req, res) => {
    const data = await tokenTransferService.getTransfers(req.query);
    return response.success(res, "Token transfers fetched successfully", data);
});

exports.getTransferById = asyncHandler(async (req, res) => {
    const data = await tokenTransferService.getTransferById(req.params.id);
    return response.success(res, "Token transfer fetched successfully", data);
});

exports.getPartnerBalances = asyncHandler(async (req, res) => {
    const data = await tokenTransferService.getPartnerBalances(
        req.params.partnerId
    );
    return response.success(res, "Partner token balances fetched", data);
});

exports.getTransferReasons = asyncHandler(async (req, res) => {
    const { TRANSFER_REASONS } = require("../creditToken/tokenTransfer.model");
    const { REASON_LABELS } = require("../creditToken/tokenTransfer.mapper");

    return response.success(
        res,
        "Transfer reasons fetched",
        TRANSFER_REASONS.map((value) => ({
            value,
            label: REASON_LABELS[value] || value,
        }))
    );
});
