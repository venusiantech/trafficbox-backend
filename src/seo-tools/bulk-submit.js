function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeCategory(category) {
  const raw = String(category || "").trim();
  return raw || "Other";
}

function getDirectoryCatalog() {
  // Static placeholder directories for initial non-functional release.
  return [
    {
      directory: "Crunchbase",
      url: "https://www.crunchbase.com/add-new",
      da: 91,
      dofollow: false,
      category: "Business",
      instructions: "Create a company profile and add your official website URL.",
    },
    {
      directory: "Product Hunt",
      url: "https://www.producthunt.com/posts/new",
      da: 90,
      dofollow: true,
      category: "Technology",
      instructions: "Launch your product and include a clear project description.",
    },
    {
      directory: "AllTop",
      url: "https://alltop.com/",
      da: 73,
      dofollow: true,
      category: "Marketing",
      instructions: "Submit your site in the most relevant category.",
    },
    {
      directory: "Capterra",
      url: "https://www.capterra.com/vendors/sign-up/",
      da: 86,
      dofollow: false,
      category: "Technology",
      instructions: "Create a vendor listing with product details and screenshots.",
    },
    {
      directory: "Foursquare",
      url: "https://foursquare.com/business/claim",
      da: 92,
      dofollow: false,
      category: "Business",
      instructions: "Claim your business listing and verify business details.",
    },
    {
      directory: "Hotfrog",
      url: "https://www.hotfrog.com/add-your-business",
      da: 67,
      dofollow: true,
      category: "Business",
      instructions: "Add your business profile with contact and service information.",
    },
    {
      directory: "Sitejabber",
      url: "https://www.sitejabber.com/business",
      da: 79,
      dofollow: true,
      category: "Marketing",
      instructions: "Create a business profile and encourage real customer reviews.",
    },
    {
      directory: "Cylex",
      url: "https://www.cylex.us.com/add-company/",
      da: 64,
      dofollow: true,
      category: "Other",
      instructions: "Submit your company profile and verify it via email.",
    },
  ];
}

async function runBulkSubmit(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const body = req.body || {};
  const websiteUrl = toAbsoluteUrl(body.website_url);
  const websiteName = String(body.website_name || "").trim();
  const email = String(body.email || "").trim();
  const websiteDescription = String(body.website_description || "").trim();
  const category = normalizeCategory(body.category);

  if (!websiteUrl) {
    return res.status(400).json({ detail: "Missing required field: website_url" });
  }
  if (!websiteName) {
    return res.status(400).json({ detail: "Missing required field: website_name" });
  }
  if (!email) {
    return res.status(400).json({ detail: "Missing required field: email" });
  }

  const baseSubmissionData = {
    website_url: websiteUrl,
    website_name: websiteName,
    website_description: websiteDescription,
    // Python parity key:
    description: websiteDescription,
    category,
    email,
  };

  const submissions = getDirectoryCatalog().map((entry) => ({
    directory: entry.directory,
    url: entry.url,
    da: entry.da,
    category: entry.category,
    dofollow: entry.dofollow,
    status: "ready",
    instructions: entry.instructions,
    submission_data: baseSubmissionData,
  }));

  // Python parity: high DA (90+) OR dofollow
  const priority_list = submissions
    .filter((s) => s.da >= 90 || s.dofollow)
    .sort((a, b) => {
      if (b.da !== a.da) return b.da - a.da;
      return Number(b.dofollow) - Number(a.dofollow);
    });

  const by_category = submissions.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return res.json({
    success: true,
    website_url: websiteUrl,
    total_directories: submissions.length,
    priority_directories: priority_list.length,
    submissions,
    by_category,
    priority_list,
    tips: [
      "Start with high DA directories (90+) for maximum SEO impact",
      "Dofollow links pass more SEO value than nofollow",
      "Use consistent NAP (Name, Address, Phone) across all submissions",
      "Complete your profile fully on each platform",
      "Add your website description naturally without keyword stuffing",
    ],
  });
}

module.exports = { runBulkSubmit };

