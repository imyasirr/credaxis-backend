const { param, query, body } = require("express-validator");
const {
    MANDATE_STATES,
    MANDATE_FREQUENCIES,
    MODES,
    INSTALLMENT_STATES,
    API_LOG_STATUS,
    WEBHOOK_ENTITY_TYPES,
} = require("../../api/mandate/constants");

exports.listUsersSummary = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("search").optional().trim(),
];

exports.listMandates = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("state").optional().trim().toUpperCase().isIn(MANDATE_STATES),
    query("frequency")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(MANDATE_FREQUENCIES),
    query("mode").optional().trim().toUpperCase().isIn(MODES),
    query("search").optional().trim(),
    query("userId").optional().isMongoId(),
    query("deleted").optional().isIn(["true", "false", "1", "0"]),
];

exports.mandateId = [
    param("id").trim().notEmpty().withMessage("Mandate id is required"),
];

exports.listInstallments = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("state")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(INSTALLMENT_STATES),
    query("mandateId").optional().trim(),
    query("rocketpayMandateId").optional().trim(),
    query("search").optional().trim(),
];

exports.installmentId = [
    param("id").trim().notEmpty().withMessage("Installment id is required"),
];

exports.retryInstallment = [
    body("schedule_date")
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("schedule_date must be YYYY-MM-DD"),
];

exports.recon = [
    body("page_number").optional().isInt({ min: 1 }),
    body("page_size").optional().isInt({ min: 1, max: 100 }),
    body("ids").optional().isArray(),
    body("ids.*").optional().trim().notEmpty(),
];

exports.listTransactions = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("entityType").optional().trim().toUpperCase().isIn([
        "MANDATE",
        "INSTALLMENT",
    ]),
    query("state").optional().trim(),
    query("mandateId").optional().trim(),
    query("installmentId").optional().trim(),
    query("search").optional().trim(),
];

exports.listWebhooks = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("entityType")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(WEBHOOK_ENTITY_TYPES),
    query("processed").optional().isIn(["true", "false", "1", "0"]),
    query("search").optional().trim(),
];

exports.listApiLogs = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().trim().toUpperCase().isIn(API_LOG_STATUS),
    query("apiName").optional().trim(),
    query("userId").optional().isMongoId(),
    query("search").optional().trim(),
];
