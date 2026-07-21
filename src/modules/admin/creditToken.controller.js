const adminCreditTokenService = require("./creditToken.service");

const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getTokens = asyncHandler(async (req, res) => {
    const data = await adminCreditTokenService.getTokens(req.query);
    return response.success(res, "Tokens fetched successfully", data);
});

exports.getTokenTypes = asyncHandler(async (req, res) => {
    const data = adminCreditTokenService.getTokenTypes();
    return response.success(res, "Token types fetched", data);
});

exports.getTokenById = asyncHandler(async (req, res) => {
    const data = await adminCreditTokenService.getTokenById(req.params.id);
    return response.success(res, "Token fetched successfully", data);
});

exports.createToken = asyncHandler(async (req, res) => {
    const data = await adminCreditTokenService.createToken(
        req.user.id,
        req.body
    );
    return response.success(res, "Token created successfully", data);
});

exports.updateToken = asyncHandler(async (req, res) => {
    const data = await adminCreditTokenService.updateToken(
        req.params.id,
        req.body
    );
    return response.success(res, "Token updated successfully", data);
});

exports.deleteToken = asyncHandler(async (req, res) => {
    const data = await adminCreditTokenService.deleteToken(req.params.id);
    return response.success(res, "Token deleted successfully", data);
});
