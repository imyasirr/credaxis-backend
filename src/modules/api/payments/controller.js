const paymentService = require("./service");
const creditCheckFeeService = require("./creditCheckFee.service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.createPayment = asyncHandler(async (req, res) => {
    const data = await paymentService.createPayment(req.user.id, req.body);
    return response.success(res, "Payment order created", data, 201);
});

exports.verifyPayment = asyncHandler(async (req, res) => {
    const data = await paymentService.verifyPayment(req.user.id, req.body);
    return response.success(res, "Payment verified successfully", data);
});

exports.getPaymentById = asyncHandler(async (req, res) => {
    const data = await paymentService.getPaymentById(
        req.user.id,
        req.params.id
    );
    return response.success(res, "Payment fetched", data);
});

exports.getCreditCheckFee = asyncHandler(async (_req, res) => {
    const data = await creditCheckFeeService.getCreditCheckFeeSetting();
    return response.success(res, "Credit check fee fetched", data);
});
