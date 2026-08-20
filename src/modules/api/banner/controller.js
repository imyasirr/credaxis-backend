const bannerService = require("./service");

const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");
const { getClientIp } = require("../../../utils/clientIp");

exports.getActiveBanners = asyncHandler(async (req, res) => {
    const banners = await bannerService.listActive();
    return response.success(res, "Banners fetched successfully", { banners });
});

exports.recordClick = asyncHandler(async (req, res) => {
    const data = await bannerService.recordClick({
        bannerId: req.params.id,
        userId: req.user?.id || null,
        roleName: req.user?.role || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
    });
    return response.success(res, "Banner click recorded", data);
});
