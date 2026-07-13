const ScratchPrize = require("../rewards/scratchPrize.model");
const createRewardPrizeService = require("./admin.rewardPrize.service.factory");

module.exports = createRewardPrizeService(ScratchPrize, "Scratch prize");
