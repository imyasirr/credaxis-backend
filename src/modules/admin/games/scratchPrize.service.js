const ScratchPrize = require("../../api/rewards/scratchPrize.model");
const createRewardPrizeService = require("./rewardPrize.service.factory");

module.exports = createRewardPrizeService(ScratchPrize, "Scratch prize");
