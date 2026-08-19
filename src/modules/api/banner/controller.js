const bannerService = require("./service");

const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.getActiveBanners = asyncHandler(async (req, res) => {
    const banners = await bannerService.listActive();
    return response.success(res, "Banners fetched successfully", { banners });
});
