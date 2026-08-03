const bubbleGameService = require("../../api/bubbleGame/service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");
const { body } = require("express-validator");

exports.getSettings = asyncHandler(async (req, res) => {
    const data = await bubbleGameService.getSettings();
    return response.success(res, "Bubble Pop settings fetched", data);
});

exports.updateSettings = asyncHandler(async (req, res) => {
    const data = await bubbleGameService.updateSettings(req.body);
    return response.success(res, "Bubble Pop settings updated", data);
});

exports.updateSettingsValidators = [
    body("enabled").optional().isBoolean(),
    body("totalBubbles").optional().isInt({ min: 5, max: 200 }),
    body("fallSpeed").optional().isFloat({ min: 2, max: 4 }),
    body("coinsPerBubble").optional().isFloat({ min: 0, max: 100 }),
    body("bombCount").optional().isInt({ min: 0, max: 30 }),
    body("maxMisses").optional().isInt({ min: 1, max: 20 }),
    body("maxCoinsPerPlay").optional().isInt({ min: 1, max: 10000 }),
];
