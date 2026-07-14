/**
 * Laravel-style helpers for Express debugging.
 *
 * Usage:
 *   const { dump, dd } = require("../../utils/debug");
 *
 *   dump(req.user);          // logs and continues (like dump())
 *   return dd(req.body);     // logs and STOPS the request (like dd())
 */

const dump = (...args) => {
    console.log("\n========== DUMP ==========");
    args.forEach((arg, index) => {
        console.log(`[${index}]`, typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg);
    });
    console.log("==========================\n");
};

const dd = (res, ...args) => {
    dump(...args);

    if (res && typeof res.status === "function") {
        return res.status(200).json({
            success: true,
            debug: true,
            message: "dd() stopped here",
            data: args.length === 1 ? args[0] : args,
        });
    }

    // If called without res, just throw to stop the stack
    const error = new Error("dd() — execution stopped");
    error.statusCode = 200;
    error.isDebug = true;
    error.debugData = args.length === 1 ? args[0] : args;
    throw error;
};

module.exports = { dump, dd };
