const ShufflePrize = require("../rewards/shufflePrize.model");
const createRewardPrizeService = require("./admin.rewardPrize.service.factory");

module.exports = createRewardPrizeService(ShufflePrize, "Shuffle prize");
