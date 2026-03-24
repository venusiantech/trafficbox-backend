const express = require("express");

const { runIndexChecker } = require("../seo-tools/index-checker");
const { runBulkSubmit } = require("../seo-tools/bulk-submit");
const { runMetaAnalyzer } = require("../seo-tools/meta-analyzer");
const { runScoreCalculator } = require("../seo-tools/score-calculator");
const { runSitemapGenerator } = require("../seo-tools/sitemap-generator");
const { runRobotsGenerator } = require("../seo-tools/robots-generator");
const { runHeadersAnalyzer } = require("../seo-tools/headers-analyzer");
const { runLinksChecker } = require("../seo-tools/links-checker");
const { runSslChecker } = require("../seo-tools/ssl-checker");
const { runDomainChecker } = require("../seo-tools/domain-checker");
const { runDnsChecker } = require("../seo-tools/dns-checker");
const { runSchemaGenerator } = require("../seo-tools/schema-generator");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /seo-suit/:toolName
 *
 * Tools are currently non-functional stubs (static responses)
 * so the frontend can integrate and we can iterate later.
 */
router.post("/:toolName", requireRole(), async (req, res) => {
  const { toolName } = req.params;

  // toolName is expected to match frontend tab ids, e.g. "index-checker".
  const normalizedToolName = String(toolName || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  try {
    if (normalizedToolName === "index-checker") {
      return runIndexChecker(req, res);
    }
    if (normalizedToolName === "bulk-submit") {
      return runBulkSubmit(req, res);
    }
    if (normalizedToolName === "meta") {
      return runMetaAnalyzer(req, res);
    }
    if (normalizedToolName === "score") {
      return runScoreCalculator(req, res);
    }
    if (normalizedToolName === "sitemap") {
      return runSitemapGenerator(req, res);
    }
    if (normalizedToolName === "robots") {
      return runRobotsGenerator(req, res);
    }
    if (normalizedToolName === "headers") {
      return runHeadersAnalyzer(req, res);
    }
    if (normalizedToolName === "links") {
      return runLinksChecker(req, res);
    }
    if (normalizedToolName === "ssl") {
      return runSslChecker(req, res);
    }
    if (normalizedToolName === "domain") {
      return runDomainChecker(req, res);
    }
    if (normalizedToolName === "dns") {
      return runDnsChecker(req, res);
    }
    if (normalizedToolName === "schema") {
      return runSchemaGenerator(req, res);
    }

    return res.status(404).json({
      detail: `Unknown SEO tool: ${toolName}`,
    });
  } catch (err) {
    return res.status(500).json({
      detail: err?.message || "Failed to run SEO tool",
    });
  }
});

module.exports = router;

