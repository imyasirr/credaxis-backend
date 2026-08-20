const { verifyToken } = require("../utils/jwt");
const userRepository = require("../modules/api/user/repository");
const roleRepository = require("../modules/role/repository");

/**
 * Attach req.user when a valid Bearer token is present.
 * Missing/invalid token → continue as anonymous (no 401).
 */
module.exports = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return next();
        }

        const decoded = verifyToken(authHeader.split(" ")[1]);
        const user = await userRepository.findById(decoded.id);
        if (!user || user.isDeleted) {
            return next();
        }

        const role = await roleRepository.findById(user.role);

        req.user = {
            id: user._id.toString(),
            role: role?.name || null,
            status: user.status,
        };

        next();
    } catch {
        next();
    }
};
