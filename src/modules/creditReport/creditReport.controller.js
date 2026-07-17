const creditReportService = require("./creditReport.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.fetchMyCreditReport = asyncHandler(async (req, res) => {
    const data = await creditReportService.fetchForUser(req.user.id, req.body);
    return response.success(res, "Credit report fetched successfully", data, 201);
});

exports.getMyReports = asyncHandler(async (req, res) => {
    const data = await creditReportService.getMyReports(req.user.id, req.query);
    return response.success(res, "Credit reports fetched", data);
});

exports.getMyLatestReport = asyncHandler(async (req, res) => {
    const data = await creditReportService.getMyLatestReport(req.user.id);
    return response.success(res, "Latest credit report fetched", data);
});

exports.getMyReportById = asyncHandler(async (req, res) => {
    const data = await creditReportService.getReportById(
        req.user.id,
        req.params.id
    );
    return response.success(res, "Credit report fetched", data);
});

exports.adminFetch = asyncHandler(async (req, res) => {
    const data = await creditReportService.fetchByAdmin(req.user.id, req.body);
    return response.success(
        res,
        "Credit report fetched successfully",
        data,
        201
    );
});

exports.adminList = asyncHandler(async (req, res) => {
    const data = await creditReportService.listAdminReports(req.query);
    return response.success(res, "Credit reports fetched", data);
});

exports.adminGetById = asyncHandler(async (req, res) => {
    const data = await creditReportService.getReportById(
        req.user.id,
        req.params.id,
        { asAdmin: true }
    );
    return response.success(res, "Credit report fetched", data);
});

exports.adminUserChecklist = asyncHandler(async (req, res) => {
    const data = await creditReportService.getAdminUserChecklist(
        req.params.userId,
        req.query
    );
    return response.success(res, "User credit checklist fetched", data);
});
