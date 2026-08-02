const express = require("express");
const websiteController = require("./controller");
const websiteValidator = require("./validator");
const validate = require("../../middleware/validation.middleware");

const router = express.Router();

router.get("/pages", websiteController.getPages);

router.get(
    "/pages/:slug",
    websiteValidator.getBySlug,
    validate,
    websiteController.getPageBySlug
);

router.get(
    "/pages/:slug/sections/:sectionKey",
    websiteValidator.getSection,
    validate,
    websiteController.getPageSection
);

module.exports = router;
