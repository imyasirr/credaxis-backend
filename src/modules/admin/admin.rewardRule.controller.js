const adminRewardRuleService = require("./admin.rewardRule.service");
const asyncHandler = require("../../utils/asyncHandler");
const response = require("../../utils/response");

exports.getMeta = asyncHandler(async (req, res) => {
    const data = adminRewardRuleService.getMeta();
    return response.success(res, "Reward rule meta fetched", data);
});

exports.listRules = asyncHandler(async (req, res) => {
    const data = await adminRewardRuleService.listRules(req.query);
    return response.success(res, "Reward rules fetched", data);
});

exports.getRuleById = asyncHandler(async (req, res) => {
    const data = await adminRewardRuleService.getRuleById(req.params.id);
    return response.success(res, "Reward rule fetched", data);
});

exports.createRule = asyncHandler(async (req, res) => {
    const data = await adminRewardRuleService.createRule(
        req.body,
        req.user.id
    );
    return response.success(res, "Reward rule created", data, 201);
});

exports.updateRule = asyncHandler(async (req, res) => {
    const data = await adminRewardRuleService.updateRule(
        req.params.id,
        req.body
    );
    return response.success(res, "Reward rule updated", data);
});

exports.deleteRule = asyncHandler(async (req, res) => {
    const data = await adminRewardRuleService.deleteRule(req.params.id);
    return response.success(res, "Reward rule deleted", data);
});

exports.grantManual = asyncHandler(async (req, res) => {
    const data = await adminRewardRuleService.grantManual({
        ...req.body,
        adminId: req.user.id,
    });
    return response.success(res, "Reward granted successfully", data, 201);
});
