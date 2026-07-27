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
const gamesDist = path.join(__dirname, "../../games-webview/dist");
const hasWebsite = fs.existsSync(path.join(websiteDist, "index.html"));
const hasAdmin = fs.existsSync(path.join(adminDist, "index.html"));
const hasGames = fs.existsSync(path.join(gamesDist, "index.html"));

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

// Games WebView SPA at /games/ (built with VITE_BASE_PATH=/games/)
// Use exact regex for trailing-slash redirect — Express non-strict
// routing treats "/games" and "/games/" as the same string route (301 loop).
if (hasGames) {
    app.get(/^\/games$/, (req, res) => {
        res.redirect(301, "/games/");
    });
    app.use(
        "/games",
        express.static(gamesDist, { index: false, fallthrough: true })
    );
    app.get(/^\/games\/.*/, (req, res) => {
        res.sendFile(path.join(gamesDist, "index.html"));
    });
}

// Admin SPA at /admin/ (built with VITE_BASE_PATH=/admin/)
if (hasAdmin) {
    app.get(/^\/admin$/, (req, res) => {
        res.redirect(301, "/admin/");
    });
    app.use(
        "/admin",
        express.static(adminDist, { index: false, fallthrough: true })
    );
    app.get(/^\/admin\/.*/, (req, res) => {
        res.sendFile(path.join(adminDist, "index.html"));
    });
}

// Marketing website at /
if (hasWebsite) {
    app.use(express.static(websiteDist, { index: false, fallthrough: true }));
    app.get(
        /^\/(?!api(?:\/|$)|uploads(?:\/|$)|admin(?:\/|$)|games(?:\/|$)).*$/,
        (req, res) => {
            res.sendFile(path.join(websiteDist, "index.html"));
        }
    );
} else {
    app.get("/", (req, res) => {
        res.json({
            message: "CredAxis Backend Running",
            website: hasWebsite,
            admin: hasAdmin,
            games: hasGames,
        });
    });
}

app.use(errorMiddleware);

module.exports = app;
