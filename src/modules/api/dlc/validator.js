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
    body("name")
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("name max 200 chars"),
    body("mobile_number").optional().trim(),
    body("customer").optional().isObject(),
    body("customer.name").optional().trim().isLength({ max: 200 }),
    body("customer.mobile_number").optional().trim(),
    body("device_info")
        .optional()
        .isObject()
        .withMessage("device_info must be an object"),
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
    body().custom((_, { req }) => {
        const b = req.body || {};
        const name = b.name || b.customer?.name;
        const mobile = b.mobile_number || b.customer?.mobile_number;
        const manufacturer =
            b.device_info?.manufacturer || b.manufacturer;
        const model = b.device_info?.model || b.model;
        const imei = b.device_info?.imei_no || b.imei_no;
        if (!name || !String(name).trim()) {
            throw new Error("name (customer) is required");
        }
        if (!mobile || !String(mobile).trim()) {
            throw new Error("mobile_number (customer) is required");
        }
        if (!manufacturer || !String(manufacturer).trim()) {
            throw new Error("device_info.manufacturer is required");
        }
        if (!model || !String(model).trim()) {
            throw new Error("device_info.model is required");
        }
        if (!imei || !/^\d{14,16}$/.test(String(imei).trim())) {
            throw new Error("device_info.imei_no must be 14-16 digits");
        }
        return true;
    }),
];

exports.listKeys = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().trim(),
    query("search").optional().trim(),
    query("customerMobile").optional().trim(),
    query("userId").optional().isMongoId(),
    query("locked").optional().isIn(["true", "false", "1", "0"]),
];

exports.listCustomers = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("search").optional().trim(),
    query("locked").optional().isIn(["true", "false", "1", "0"]),
];

exports.getCustomer = [
    query("mobile").optional().trim(),
    query("id").optional().trim(),
    param("mobile").optional().trim(),
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

exports.assignMerchant = [
    body("userId").optional().isMongoId().withMessage("Invalid userId"),
    body("mobile").optional().trim(),
    body().custom((_, { req }) => {
        if (!req.body?.userId && !req.body?.mobile) {
            throw new Error("userId or mobile is required");
        }
        return true;
    }),
];
