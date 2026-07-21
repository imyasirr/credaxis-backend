const adminCoinsService = require("./coins.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getCoinWallets = asyncHandler(async (req, res) => {
    const data = await adminCoinsService.getCoinWallets(req.query);
    return response.success(res, "Coin accounts fetched successfully", data);
});

exports.getCoinWalletById = asyncHandler(async (req, res) => {
    const data = await adminCoinsService.getCoinWalletById(req.params.id);
    return response.success(res, "Coin account fetched successfully", data);
});

exports.createCoinWallet = asyncHandler(async (req, res) => {
    const data = await adminCoinsService.createCoinWallet(req.body);
    return response.success(res, "Coin account created successfully", data);
});

exports.updateCoinWallet = asyncHandler(async (req, res) => {
    const data = await adminCoinsService.updateCoinWallet(
        req.params.id,
        req.body
    );
    return response.success(res, "Coin account updated successfully", data);
});

exports.adjustBalance = asyncHandler(async (req, res) => {
    const data = await adminCoinsService.adjustBalance(
        req.params.id,
        req.body
    );
    return response.success(res, "Coin balance adjusted", data);
});

exports.deleteCoinWallet = asyncHandler(async (req, res) => {
    const data = await adminCoinsService.deleteCoinWallet(req.params.id);
    return response.success(res, "Coin account blocked successfully", data);
});
