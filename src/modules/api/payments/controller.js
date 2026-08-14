const paymentService = require("./service");
const creditCheckFeeService = require("./creditCheckFee.service");
const mandateCreateFeeService = require("./mandateCreateFee.service");
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

exports.getCreditCheckFee = asyncHandler(async (req, res) => {
    const data = await creditCheckFeeService.getCreditCheckQuote(req.user.id);
    return response.success(res, "Credit check fee fetched", data);
});

exports.getMandateCreateFee = asyncHandler(async (req, res) => {
    const frequency =
        req.query.frequency || req.query.Frequency || null;
    const installmentCount =
        req.query.installment_count ??
        req.query.installmentCount ??
        0;
    const data = await mandateCreateFeeService.getMandateCreateQuote(
        req.user.id,
        {
            frequency,
            installmentCount,
        }
    );
    return response.success(res, "Mandate fees quote fetched", data);
});
