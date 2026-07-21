const ShufflePrize = require("../rewards/shufflePrize.model");
const createRewardPrizeService = require("./rewardPrize.service.factory");

module.exports = createRewardPrizeService(ShufflePrize, "Shuffle prize");
