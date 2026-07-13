const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");
const createRewardPrizeController = require("./admin.rewardPrize.controller.factory");
const adminScratchPrizeService = require("./admin.scratchPrize.service");

const controller = createRewardPrizeController(adminScratchPrizeService);

exports.getPrizes = asyncHandler(async (req, res) => {
    const data = await adminScratchPrizeService.getPrizes(req.query);
    return response.success(res, "Scratch prizes fetched successfully", data);
});

exports.getPrizeTypes = asyncHandler(async (req, res) => {
    const data = adminScratchPrizeService.getPrizeTypes();
    return response.success(res, "Prize types fetched", data);
});

exports.getPrizeById = asyncHandler(async (req, res) => {
    const data = await adminScratchPrizeService.getPrizeById(req.params.id);
    return response.success(res, "Scratch prize fetched successfully", data);
});

exports.createPrize = asyncHandler(async (req, res) => {
    const data = await adminScratchPrizeService.createPrize(
        req.user.id,
        req.body
    );
    return response.success(res, "Scratch prize created successfully", data);
});

exports.updatePrize = asyncHandler(async (req, res) => {
    const data = await adminScratchPrizeService.updatePrize(
        req.params.id,
        req.body
    );
    return response.success(res, "Scratch prize updated successfully", data);
});

exports.deletePrize = asyncHandler(async (req, res) => {
    const data = await adminScratchPrizeService.deletePrize(req.params.id);
    return response.success(res, "Scratch prize deleted successfully", data);
});
