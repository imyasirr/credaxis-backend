require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("../../config/db");
const User = require("../user/user.model");
const UserProfile = require("../user/userProfile.model");
const Wallet = require("../wallet/wallet.model");
const Role = require("../role/role.model");
const ROLES = require("../../constants/roles");
const { hash } = require("../../utils/password");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@credaxis.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345678";
const ADMIN_MOBILE = process.env.ADMIN_MOBILE || "9999900000";

async function seed() {
    await connectDB();

    const adminRole = await Role.findOne({ name: ROLES.ADMIN });

    if (!adminRole) {
        console.error("Admin role not found. Run npm run seed:roles first.");
        process.exit(1);
    }

    const passwordHash = await hash(ADMIN_PASSWORD);

    let admin = await User.findOne({
        $or: [{ email: ADMIN_EMAIL }, { mobile: ADMIN_MOBILE }],
    });

    if (!admin) {
        admin = await User.create({
            email: ADMIN_EMAIL,
            mobile: ADMIN_MOBILE,
            password: passwordHash,
            role: adminRole._id,
            isMobileVerified: true,
            isEmailVerified: true,
            status: "ACTIVE",
        });

        await UserProfile.create({
            user: admin._id,
            firstName: "Super",
            lastName: "Admin",
            isProfileComplete: true,
        });

        await Wallet.create({
            user: admin._id,
            walletNumber: "WAL" + Date.now(),
        });

        console.log("Admin user created");
    } else {
        admin.email = ADMIN_EMAIL;
        admin.password = passwordHash;
        admin.role = adminRole._id;
        admin.status = "ACTIVE";
        admin.isEmailVerified = true;
        admin.isMobileVerified = true;
        await admin.save();

        const profile = await UserProfile.findOne({ user: admin._id });

        if (!profile) {
            await UserProfile.create({
                user: admin._id,
                firstName: "Super",
                lastName: "Admin",
                isProfileComplete: true,
            });
        }

        const wallet = await Wallet.findOne({ user: admin._id });

        if (!wallet) {
            await Wallet.create({
                user: admin._id,
                walletNumber: "WAL" + Date.now(),
            });
        }

        console.log("Admin user updated");
    }

    console.log(`Admin email: ${ADMIN_EMAIL}`);
    console.log(`Admin password: ${ADMIN_PASSWORD}`);

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(async (err) => {
    console.error("Seed Error:", err.message);
    await mongoose.disconnect();
    process.exit(1);
});
