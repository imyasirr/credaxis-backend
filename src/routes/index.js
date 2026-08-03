const express = require("express");

const router = express.Router();

// App (mobile) API — modules/api/*
router.use(require("../modules/api/routes"));

// Admin panel API — modules/admin/*
router.use("/admin", require("../modules/admin/routes"));

// Public website CMS API — modules/website/*
router.use("/website", require("../modules/website/routes"));

module.exports = router;
