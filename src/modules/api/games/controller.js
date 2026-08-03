const gamesService = require("./service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.getPrizes = asyncHandler(async (req, res) => {
    const data = await gamesService.getActivePrizes(req.params.gameType);
    return response.success(res, "Prizes fetched", data);
});

exports.play = asyncHandler(async (req, res) => {
    const data = await gamesService.play(req.user.id, req.params.gameType);
    return response.success(res, "Play complete", data);
});
