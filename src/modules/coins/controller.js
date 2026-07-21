const coinService = require("./service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getMyCoins = asyncHandler(async (req, res) => {
    const data = await coinService.getMyCoins(req.user.id);
    return response.success(res, "Coins fetched successfully", data);
});

exports.getTransactions = asyncHandler(async (req, res) => {
    const data = await coinService.getTransactions(req.user.id, req.query);
    return response.success(res, "Coin transactions fetched", data);
});
