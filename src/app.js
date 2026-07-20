const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const routes = require("./routes");
const errorMiddleware = require("./middleware/error.middleware");

const app = express();

const websiteDist = path.join(__dirname, "../../credaxis-website/dist");
const adminDist = path.join(__dirname, "../../admin-panel/dist");
const hasWebsite = fs.existsSync(path.join(websiteDist, "index.html"));
const hasAdmin = fs.existsSync(path.join(adminDist, "index.html"));

app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
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

app.use("/api", routes);

// Admin SPA at /admin/ (built with VITE_BASE_PATH=/admin/)
if (hasAdmin) {
    app.get("/admin", (req, res) => {
        res.redirect(301, "/admin/");
    });
    app.use(
        "/admin",
        express.static(adminDist, { index: false, fallthrough: true })
    );
    app.get(/^\/admin(\/.*)?$/, (req, res) => {
        res.sendFile(path.join(adminDist, "index.html"));
    });
}

// Marketing website at /
if (hasWebsite) {
    app.use(express.static(websiteDist, { index: false, fallthrough: true }));
    app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)|admin(?:\/|$)).*$/, (req, res) => {
        res.sendFile(path.join(websiteDist, "index.html"));
    });
} else {
    app.get("/", (req, res) => {
        res.json({
            message: "CredAxis Backend Running",
            website: hasWebsite,
            admin: hasAdmin,
        });
    });
}

app.use(errorMiddleware);

module.exports = app;
