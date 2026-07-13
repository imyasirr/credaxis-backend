const dns = require("dns");
const mongoose = require("mongoose");

// Some ISPs fail to resolve MongoDB Atlas SRV records (querySrv ECONNREFUSED).
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const getMongoUri = () => {
    if (process.env.MONGO_URI) {
        return process.env.MONGO_URI;
    }

    const { MONGO_USER, MONGO_PASSWORD, MONGO_HOST, MONGO_DB, MONGO_OPTIONS } =
        process.env;

    return `mongodb+srv://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}/${MONGO_DB}?${MONGO_OPTIONS}`;
};

const connectDB = async () => {
    try {
        await mongoose.connect(getMongoUri(), {
            serverSelectionTimeoutMS: 15000,
        });

        console.log("MongoDB Connected");
    } catch (err) {
        console.error("Database Error:", err.message);
        throw err;
    }
};

module.exports = connectDB;