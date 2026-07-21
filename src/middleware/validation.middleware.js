const { validationResult } = require("express-validator");

module.exports = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const items = errors.array();
        return res.status(422).json({
            success: false,
            message: items.map((e) => e.msg).filter(Boolean).join(". "),
            errors: items,
        });
    }

    next();
};
