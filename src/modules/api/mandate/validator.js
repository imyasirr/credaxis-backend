const { body, param, query } = require("express-validator");
const {
    MANDATE_FREQUENCIES,
    MANDATE_STATES,
    INSTALLMENT_STATES,
    MODES,
} = require("./constants");

const RECURRING = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

exports.createMandate = [
    body("customer").isObject().withMessage("customer is required"),
    body("customer.mobile_number")
        .trim()
        .notEmpty()
        .withMessage("customer.mobile_number is required"),
    body("customer.name").optional().trim().isLength({ max: 200 }),
    body("customer.instrument")
        .optional()
        .isObject()
        .withMessage("customer.instrument must be an object")
        .bail()
        .custom((instrument) => {
            const type = String(instrument.type || "").toUpperCase();

            if (type === "VPA") {
                if (
                    typeof instrument.vpa !== "string" ||
                    !instrument.vpa.trim()
                ) {
                    throw new Error(
                        "customer.instrument.vpa is required when type is VPA"
                    );
                }
                return true;
            }

            const requiredFields = [
                "type",
                "account_number",
                "ifsc",
                "account_holder_name",
                "account_type",
            ];
            const missingFields = requiredFields.filter(
                (field) =>
                    typeof instrument[field] !== "string" ||
                    !instrument[field].trim()
            );

            if (missingFields.length > 0) {
                throw new Error(
                    `customer.instrument missing fields: ${missingFields.join(", ")}`
                );
            }

            return true;
        }),
    body("customer.instrument.type")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("customer.instrument.type is required"),
    body("customer.instrument.account_number")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("customer.instrument.account_number is required"),
    body("customer.instrument.ifsc")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("customer.instrument.ifsc is required"),
    body("customer.instrument.account_holder_name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("customer.instrument.account_holder_name is required"),
    body("customer.instrument.account_type")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("customer.instrument.account_type is required"),
    body("mode")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(MODES)
        .withMessage(`mode must be one of: ${MODES.join(", ")}`),
    body("schedule").isObject().withMessage("schedule is required"),
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
    body("schedule").custom((schedule) => {
        const frequency = String(schedule?.frequency || "")
            .trim()
            .toUpperCase();
        const amount = Number(schedule?.amount);
        const approval = Number(schedule?.approval_amount);
        const hasAmount =
            (Number.isFinite(amount) && amount > 0) ||
            (Number.isFinite(approval) && approval > 0);

        if (!hasAmount) {
            throw new Error(
                "schedule.amount or schedule.approval_amount (> 0) is required"
            );
        }

        if (RECURRING.includes(frequency)) {
            const count = Number(schedule?.installment_count);
            if (!Number.isInteger(count) || count < 1) {
                throw new Error(
                    "schedule.installment_count (>= 1) is required for recurring mandates"
                );
            }
            if (
                !schedule?.start_date ||
                !/^\d{4}-\d{2}-\d{2}$/.test(String(schedule.start_date))
            ) {
                throw new Error(
                    "schedule.start_date (YYYY-MM-DD) is required for recurring mandates"
                );
            }
        }

        return true;
    }),
    body("reference_id").optional().trim(),
    body("reference_type").optional().trim(),
    body("client_meta").optional().isObject(),
    body("paymentId")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("Invalid paymentId"),
    body("payment_id")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("Invalid payment_id"),
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
    query("state").optional().trim().toUpperCase().isIn(MANDATE_STATES),
    query("frequency")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(MANDATE_FREQUENCIES),
    query("search").optional().trim(),
];

exports.listInstallments = [
    query("mandate_id").trim().notEmpty().withMessage("mandate_id is required"),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("state")
        .optional()
        .trim()
        .toUpperCase()
        .isIn(INSTALLMENT_STATES)
        .withMessage(
            `state must be one of: ${INSTALLMENT_STATES.join(", ")}`
        ),
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
    body("paymentId")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("Invalid paymentId"),
    body("payment_id")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("Invalid payment_id"),
];

exports.retryInstallment = [
    body("schedule_date")
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("schedule_date must be YYYY-MM-DD"),
];

exports.listCollections = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("mandateId").optional().isMongoId(),
    query("state").optional().trim(),
    query("customerMobile").optional().trim(),
    query("search").optional().trim(),
];

exports.collectionsSummary = [
    query("mandateId").optional().isMongoId(),
    query("state").optional().trim(),
    query("customerMobile").optional().trim(),
    query("search").optional().trim(),
];
