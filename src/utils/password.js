const bcrypt = require("bcryptjs");

exports.hash = (password) => {
    return bcrypt.hash(password, 10);
};

exports.compare = (password, hash) => {
    return bcrypt.compare(password, hash);
};
