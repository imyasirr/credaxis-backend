const bannerService = require("../../api/banner/service");

const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");
const { getClientIp } = require("../../../utils/clientIp");

exports.getBanners = asyncHandler(async (req, res) => {
    const data = await bannerService.getBanners(req.query);
    return response.success(res, "Banners fetched successfully", data);
});

exports.getBannerById = asyncHandler(async (req, res) => {
    const data = await bannerService.getBannerById(req.params.id);
    return response.success(res, "Banner fetched successfully", data);
});

exports.createBanner = asyncHandler(async (req, res) => {
    const data = await bannerService.createBanner(
        req.user.id,
        req.body,
        req.file
    );
    return response.success(res, "Banner created successfully", data, 201);
});

exports.updateBanner = asyncHandler(async (req, res) => {
    const data = await bannerService.updateBanner(
        req.params.id,
        req.body,
        req.file
    );
    return response.success(res, "Banner updated successfully", data);
});

exports.deleteBanner = asyncHandler(async (req, res) => {
    const data = await bannerService.deleteBanner(req.params.id);
    return response.success(res, "Banner deleted successfully", data);
});

exports.getBannerClicks = asyncHandler(async (req, res) => {
    const data = await bannerService.listClicks(req.params.id, req.query);
    return response.success(res, "Banner clicks fetched successfully", data);
});

exports.recordBannerClick = asyncHandler(async (req, res) => {
    const data = await bannerService.recordClick({
        bannerId: req.params.id,
        userId: req.user?.id || null,
        roleName: req.user?.role || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        source: "ADMIN",
    });
    return response.success(res, "Banner click recorded", data);
});
