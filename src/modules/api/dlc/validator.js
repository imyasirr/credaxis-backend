const { body, param, query } = require("express-validator");

exports.catalogue = [
    query("imei")
        .trim()
        .notEmpty()
        .withMessage("imei is required")
        .matches(/^\d{14,16}$/)
        .withMessage("imei must be 14-16 digits"),
];

exports.createKey = [
    body("name").optional().trim().isLength({ min: 1, max: 200 }),
    body("mobile_number").optional().trim(),
    body("customer").optional().isObject(),
    body("customer.name").optional().trim().isLength({ max: 200 }),
    body("customer.mobile_number").optional().trim(),
    body("device_info").optional().isObject(),
    body("device_info.manufacturer").optional().trim(),
    body("device_info.model").optional().trim(),
    body("device_info.imei_no")
        .optional()
        .trim()
        .matches(/^\d{14,16}$/)
        .withMessage("imei_no must be 14-16 digits"),
    body("device_info.imei_no2")
        .optional()
        .trim()
        .matches(/^\d{14,16}$/)
        .withMessage("imei_no2 must be 14-16 digits"),
    body("manufacturer").optional().trim(),
    body("model").optional().trim(),
    body("imei_no").optional().trim(),
    body("imei_no2").optional().trim(),
];

exports.listKeys = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().trim(),
    query("search").optional().trim(),
    query("userId").optional().isMongoId(),
    query("locked").optional().isIn(["true", "false", "1", "0"]),
];

exports.keyId = [
    param("id").trim().notEmpty().withMessage("DLC key id is required"),
];

exports.lockBody = [
    body("title").optional().trim().isLength({ max: 200 }),
    body("message").optional().trim().isLength({ max: 500 }),
];

exports.reminderBody = [
    body("title").optional().trim().isLength({ max: 200 }),
    body("message").optional().trim().isLength({ max: 500 }),
];

exports.unlockCodeBody = [
    body("code")
        .trim()
        .notEmpty()
        .withMessage("code is required")
        .isLength({ max: 50 }),
];
