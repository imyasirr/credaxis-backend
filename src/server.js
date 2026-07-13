require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server Running on Port ${PORT}`);
    });
};

startServer().catch((err) => {
    console.error("Server Error:", err.message);
    process.exit(1);
});
