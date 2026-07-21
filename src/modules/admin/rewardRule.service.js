const rewardRuleService = require("../rewards/rewardRule.service");

exports.getMeta = () => rewardRuleService.getMeta();

exports.listRules = (query) => rewardRuleService.listRules(query);

exports.getRuleById = (id) => rewardRuleService.getRuleById(id);

exports.createRule = (body, adminId) =>
    rewardRuleService.createRule(body, adminId);

exports.updateRule = (id, body) => rewardRuleService.updateRule(id, body);

exports.deleteRule = (id) => rewardRuleService.deleteRule(id);

exports.grantManual = (payload) => rewardRuleService.grantManual(payload);
