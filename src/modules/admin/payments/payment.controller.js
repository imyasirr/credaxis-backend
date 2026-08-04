const adminPaymentService = require("./payment.service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.listPayments = asyncHandler(async (req, res) => {
    const data = await adminPaymentService.listPayments(req.query);
    return response.success(res, "Payments fetched successfully", data);
});

exports.getPaymentById = asyncHandler(async (req, res) => {
    const data = await adminPaymentService.getPaymentById(req.params.id);
    return response.success(res, "Payment fetched successfully", data);
});
