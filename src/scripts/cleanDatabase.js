require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("../config/db");

async function cleanDatabase() {
    await connectDB();

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
        console.log("Database already empty");
    } else {
        for (const collection of collections) {
            await db.dropCollection(collection.name);
            console.log(`Dropped: ${collection.name}`);
        }
    }

    console.log("Database cleaned successfully");
    await mongoose.disconnect();
    process.exit(0);
}

cleanDatabase().catch(async (err) => {
    console.error("Clean Error:", err.message);
    await mongoose.disconnect();
    process.exit(1);
});
