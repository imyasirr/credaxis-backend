require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../modules/user/model");

async function fixUserIndexes() {
    await connectDB();

    const collection = User.collection;

    const indexes = await collection.indexes();
    const emailIndex = indexes.find((idx) => idx.name === "email_1");

    if (emailIndex && !emailIndex.sparse) {
        console.log("Dropping old non-sparse email_1 index...");
        await collection.dropIndex("email_1");
    }

    const unsetResult = await collection.updateMany(
        { email: null },
        { $unset: { email: "" } }
    );

    if (unsetResult.modifiedCount > 0) {
        console.log(`Removed null email from ${unsetResult.modifiedCount} user(s)`);
    }

    await User.syncIndexes();
    console.log("User indexes synced");

    const updatedIndexes = await collection.indexes();
    console.log(
        updatedIndexes.map((idx) => ({
            name: idx.name,
            key: idx.key,
            sparse: idx.sparse || false,
            unique: idx.unique || false,
        }))
    );

    await mongoose.disconnect();
    process.exit(0);
}

fixUserIndexes().catch(async (err) => {
    console.error("Fix Error:", err.message);
    await mongoose.disconnect();
    process.exit(1);
});
