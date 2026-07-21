const adminTokenPurchaseService = require("./tokenPurchase.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getTokenPurchases = asyncHandler(async (req, res) => {
    const data = await adminTokenPurchaseService.getTokenPurchases(req.query);
    return response.success(res, "Token purchases fetched successfully", data);
});

exports.getTokenPurchaseById = asyncHandler(async (req, res) => {
    const data = await adminTokenPurchaseService.getTokenPurchaseById(
        req.params.id
    );
    return response.success(res, "Token purchase fetched successfully", data);
});
