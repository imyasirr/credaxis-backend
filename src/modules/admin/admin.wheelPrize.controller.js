const adminWheelPrizeService = require("./admin.wheelPrize.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getPrizes = asyncHandler(async (req, res) => {
    const data = await adminWheelPrizeService.getPrizes(req.query);
    return response.success(res, "Wheel prizes fetched successfully", data);
});

exports.getPrizeTypes = asyncHandler(async (req, res) => {
    const data = adminWheelPrizeService.getPrizeTypes();
    return response.success(res, "Prize types fetched", data);
});

exports.getPrizeById = asyncHandler(async (req, res) => {
    const data = await adminWheelPrizeService.getPrizeById(req.params.id);
    return response.success(res, "Wheel prize fetched successfully", data);
});

exports.createPrize = asyncHandler(async (req, res) => {
    const data = await adminWheelPrizeService.createPrize(
        req.user.id,
        req.body
    );
    return response.success(res, "Wheel prize created successfully", data);
});

exports.updatePrize = asyncHandler(async (req, res) => {
    const data = await adminWheelPrizeService.updatePrize(
        req.params.id,
        req.body
    );
    return response.success(res, "Wheel prize updated successfully", data);
});

exports.deletePrize = asyncHandler(async (req, res) => {
    const data = await adminWheelPrizeService.deletePrize(req.params.id);
    return response.success(res, "Wheel prize deleted successfully", data);
});
