const adminWalletService = require("./wallet.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getWallets = asyncHandler(async (req, res) => {
    const data = await adminWalletService.getWallets(req.query);
    return response.success(res, "Wallets fetched successfully", data);
});

exports.getWalletById = asyncHandler(async (req, res) => {
    const data = await adminWalletService.getWalletById(req.params.id);
    return response.success(res, "Wallet fetched successfully", data);
});

exports.createWallet = asyncHandler(async (req, res) => {
    const data = await adminWalletService.createWallet(req.body);
    return response.success(res, "Wallet created successfully", data);
});

exports.updateWallet = asyncHandler(async (req, res) => {
    const data = await adminWalletService.updateWallet(
        req.params.id,
        req.body
    );
    return response.success(res, "Wallet updated successfully", data);
});

exports.adjustBalance = asyncHandler(async (req, res) => {
    const data = await adminWalletService.adjustBalance(
        req.params.id,
        req.body
    );
    return response.success(res, "Wallet balance adjusted", data);
});

exports.deleteWallet = asyncHandler(async (req, res) => {
    const data = await adminWalletService.deleteWallet(req.params.id);
    return response.success(res, "Wallet blocked successfully", data);
});
