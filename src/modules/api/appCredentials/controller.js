const service = require("./service");
const asyncHandler = require("../../../utils/asyncHandler");
const response = require("../../../utils/response");

exports.getRocketPayCredentials = asyncHandler(async (_req, res) => {
    const data = service.getRocketPayCredentials();
    return response.success(res, "RocketPay credentials fetched", data);
});
