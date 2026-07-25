const bubbleGameService = require("./service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getConfig = asyncHandler(async (req, res) => {
    const data = await bubbleGameService.getPublicConfig();
    return response.success(res, "Bubble Pop config fetched", data);
});

exports.completePlay = asyncHandler(async (req, res) => {
    const data = await bubbleGameService.completePlay(req.user.id, req.body);
    return response.success(res, data.message || "Play completed", data);
});
