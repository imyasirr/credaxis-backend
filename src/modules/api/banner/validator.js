const { param } = require("express-validator");

exports.bannerId = [param("id").isMongoId().withMessage("Invalid banner id")];
