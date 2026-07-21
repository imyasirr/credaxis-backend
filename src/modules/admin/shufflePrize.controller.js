const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");
const adminShufflePrizeService = require("./shufflePrize.service");

exports.getPrizes = asyncHandler(async (req, res) => {
    const data = await adminShufflePrizeService.getPrizes(req.query);
    return response.success(res, "Shuffle prizes fetched successfully", data);
});

exports.getPrizeTypes = asyncHandler(async (req, res) => {
    const data = adminShufflePrizeService.getPrizeTypes();
    return response.success(res, "Prize types fetched", data);
});

exports.getPrizeById = asyncHandler(async (req, res) => {
    const data = await adminShufflePrizeService.getPrizeById(req.params.id);
    return response.success(res, "Shuffle prize fetched successfully", data);
});

exports.createPrize = asyncHandler(async (req, res) => {
    const data = await adminShufflePrizeService.createPrize(
        req.user.id,
        req.body
    );
    return response.success(res, "Shuffle prize created successfully", data);
});

exports.updatePrize = asyncHandler(async (req, res) => {
    const data = await adminShufflePrizeService.updatePrize(
        req.params.id,
        req.body
    );
    return response.success(res, "Shuffle prize updated successfully", data);
});

exports.deletePrize = asyncHandler(async (req, res) => {
    const data = await adminShufflePrizeService.deletePrize(req.params.id);
    return response.success(res, "Shuffle prize deleted successfully", data);
});
