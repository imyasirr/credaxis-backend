const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const routes = require("./routes");
const errorMiddleware = require("./middleware/error.middleware");

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(compression());
app.use(morgan("dev"));
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    "/uploads",
    express.static(path.join(__dirname, "../public/uploads"))
);

app.get("/", (req, res) => {
    res.json({
        message: "CredAxis Backend Running",
    });
});

app.use("/api", routes);

app.use(errorMiddleware);

module.exports = app;
