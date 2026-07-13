require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("../../config/db");
const Role = require("./role.model");
const ROLES = require("../../constants/roles");

const roles = [
    {
        name: ROLES.ADMIN,
        displayName: "Administrator",
    },
    {
        name: ROLES.USER,
        displayName: "User",
    },
    {
        name: ROLES.PARTNER,
        displayName: "Partner",
    },
];

async function seed() {
    await connectDB();

    for (const role of roles) {
        const exists = await Role.findOne({
            name: role.name,
        });

        if (!exists) {
            await Role.create(role);
        }
    }

    console.log("Roles Seeded");
    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(async (err) => {
    console.error("Seed Error:", err.message);
    await mongoose.disconnect();
    process.exit(1);
});
