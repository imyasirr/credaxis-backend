const adminWebsiteService = require("./service");
const asyncHandler = require("../../../utils/asyncHandler");
const { success } = require("../../../utils/response");

// ── PAGES ───────────────────────────────────────────────────────

exports.getPages = asyncHandler(async (req, res) => {
    const result = await adminWebsiteService.getAllPages(req.query);
    return success(res, "Pages retrieved successfully", result);
});

exports.getPageById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const page = await adminWebsiteService.getPageById(id);
    return success(res, "Page details retrieved successfully", page);
});

exports.createPage = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const page = await adminWebsiteService.createPage(req.body, userId);
    return success(res, "Website page created successfully", page, 201);
});

exports.updatePage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const page = await adminWebsiteService.updatePage(id, req.body, userId);
    return success(res, "Website page updated successfully", page);
});

exports.deletePage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await adminWebsiteService.deletePage(id);
    return success(res, "Website page deleted successfully", result);
});

// ── SECTIONS ─────────────────────────────────────────────────────

exports.updateSections = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const page = await adminWebsiteService.updatePageSections(
        id,
        req.body.sections || [],
        userId
    );
    return success(res, "Page sections updated successfully", page);
});

exports.upsertSection = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const page = await adminWebsiteService.upsertSection(id, req.body, userId);
    return success(res, "Page section updated successfully", page);
});

exports.deleteSection = asyncHandler(async (req, res) => {
    const { id, sectionKey } = req.params;
    const userId = req.user?.id;
    const page = await adminWebsiteService.deleteSection(id, sectionKey, userId);
    return success(res, "Page section deleted successfully", page);
});

exports.reorderSections = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const page = await adminWebsiteService.reorderSections(
        id,
        req.body.sectionOrders || [],
        userId
    );
    return success(res, "Page sections reordered successfully", page);
});

// ── MEDIA ────────────────────────────────────────────────────────

exports.getMedia = asyncHandler(async (req, res) => {
    const result = await adminWebsiteService.getAllMedia(req.query);
    return success(res, "Website media files retrieved successfully", result);
});

exports.uploadMedia = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const media = await adminWebsiteService.createMedia(
        { file: req.file, body: req.body },
        userId
    );
    return success(res, "Media uploaded successfully", media, 201);
});

exports.deleteMedia = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await adminWebsiteService.deleteMedia(id);
    return success(res, "Media deleted successfully", result);
});

// ── SEEDER ───────────────────────────────────────────────────────

exports.seedDefaultPages = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const pages = await adminWebsiteService.seedDefaultPages(userId);
    return success(res, "Default website pages seeded successfully", {
        count: pages.length,
        pages,
    });
});
