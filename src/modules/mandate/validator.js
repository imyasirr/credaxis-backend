const { body, param, query } = require("express-validator");
const { MANDATE_FREQUENCIES, MANDATE_STATES, MODES } = require("./constants");

exports.createMandate = [
    body("customer").isObject().withMessage("customer is required"),
    body("customer.mobile_number")
        .trim()
        .notEmpty()
        .withMessage("customer.mobile_number is required"),
    body("customer.name")
        .optional()
        .trim()
        .isLength({ max: 200 }),
    body("mode")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(MODES)
        .withMessage(`mode must be one of: ${MODES.join(", ")}`),
    body("schedule")
        .isObject()
        .withMessage("schedule is required"),
    body("schedule.frequency")
        .trim()
        .toUpperCase()
        .isIn(MANDATE_FREQUENCIES)
        .withMessage(
            `schedule.frequency must be one of: ${MANDATE_FREQUENCIES.join(", ")}`
        ),
    body("schedule.time_zone").optional().trim(),
    body("schedule.advance_amount").optional().isFloat({ min: 0 }),
    body("schedule.amount").optional().isFloat({ min: 0 }),
    body("schedule.installment_count").optional().isInt({ min: 0 }),
    body("schedule.start_date")
        .optional()
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("start_date must be YYYY-MM-DD"),
    body("schedule.end_date")
        .optional()
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("end_date must be YYYY-MM-DD"),
    body("schedule.approval_amount").optional().isFloat({ min: 0 }),
    body("schedule.items").optional().isArray(),
    body("reference_id").optional().trim(),
    body("reference_type").optional().trim(),
    body("client_meta").optional().isObject(),
];

exports.mandateId = [
    param("id").trim().notEmpty().withMessage("Mandate id is required"),
];

exports.installmentId = [
    param("id").trim().notEmpty().withMessage("Installment id is required"),
];

exports.listMandates = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("state")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(MANDATE_STATES),
    query("frequency")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(MANDATE_FREQUENCIES),
    query("search").optional().trim(),
];

exports.listInstallments = [
    query("mandate_id")
        .trim()
        .notEmpty()
        .withMessage("mandate_id is required"),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("state").optional().trim(),
    query("sync").optional().isIn(["true", "false", "1", "0"]),
];

exports.createInstallment = [
    body("amount")
        .isFloat({ gt: 0 })
        .withMessage("amount must be greater than 0"),
    body("due_date")
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("due_date must be YYYY-MM-DD"),
    body("reference_id").optional().trim(),
    body("description").optional().trim(),
];

exports.retryInstallment = [
    body("schedule_date")
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("schedule_date must be YYYY-MM-DD"),
];
