const { query } = require("express-validator");

exports.getTransactions = [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
];
