const websiteService = require("./service");
const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/response");

exports.getPages = asyncHandler(async (req, res) => {
    const pages = await websiteService.getPages();
    return success(res, "Pages retrieved successfully", pages);
});

exports.getPageBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const page = await websiteService.getPageBySlug(slug);
    return success(res, "Page details retrieved successfully", page);
});

exports.getPageSection = asyncHandler(async (req, res) => {
    const { slug, sectionKey } = req.params;
    const section = await websiteService.getPageSection(slug, sectionKey);
    return success(res, "Section details retrieved successfully", section);
});
