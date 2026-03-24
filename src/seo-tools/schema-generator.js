function buildSchema(schemaType, data) {
  const d = data || {};

  const templates = {
    Article: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: d.headline || "",
      author: { "@type": "Person", name: d.author || "" },
      datePublished: d.datePublished || "",
      dateModified: d.dateModified || "",
      image: d.image || "",
      publisher: {
        "@type": "Organization",
        name: d.publisher || "",
        logo: { "@type": "ImageObject", url: d.logo || "" },
      },
    },
    Product: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: d.name || "",
      description: d.description || "",
      image: d.image || "",
      brand: { "@type": "Brand", name: d.brand || "" },
      offers: {
        "@type": "Offer",
        price: d.price || "",
        priceCurrency: d.currency || "USD",
        availability: "https://schema.org/InStock",
      },
    },
    FAQ: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: Array.isArray(d.questions)
        ? d.questions.map((q) => ({
            "@type": "Question",
            name: q?.question || "",
            acceptedAnswer: { "@type": "Answer", text: q?.answer || "" },
          }))
        : [],
    },
    LocalBusiness: {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: d.name || "",
      description: d.description || "",
      image: d.image || "",
      telephone: d.phone || "",
      address: {
        "@type": "PostalAddress",
        streetAddress: d.street || "",
        addressLocality: d.city || "",
        addressRegion: d.state || "",
        postalCode: d.zip || "",
        addressCountry: d.country || "",
      },
    },
    Organization: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: d.name || "",
      url: d.url || "",
      logo: d.logo || "",
      sameAs: Array.isArray(d.social_links) ? d.social_links : [],
    },
    BreadcrumbList: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: Array.isArray(d.items)
        ? d.items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item?.name || "",
            item: item?.url || "",
          }))
        : [],
    },
  };

  return templates[schemaType] || null;
}

async function runSchemaGenerator(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { schema_type: schemaType, data } = req.body || {};
  const type = String(schemaType || "").trim();
  if (!type) {
    return res.status(400).json({ detail: "Missing required field: schema_type" });
  }

  const schema = buildSchema(type, data || {});
  if (!schema) {
    const available = [
      "Article",
      "Product",
      "FAQ",
      "LocalBusiness",
      "Organization",
      "BreadcrumbList",
    ];
    return res.status(400).json({
      error: `Unknown schema type. Available: ${available.join(", ")}`,
    });
  }

  const jsonLd = JSON.stringify(schema, null, 2);
  return res.json({
    schema_type: type,
    json_ld: jsonLd,
    html: `<script type="application/ld+json">\n${jsonLd}\n</script>`,
  });
}

module.exports = { runSchemaGenerator };

