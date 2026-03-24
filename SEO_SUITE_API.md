# SEO Suite API Documentation

This document describes the SEO Suite tools exposed by the backend route:

- Base route: `/seo-suit/:toolName`
- Alternate route: `/api/seo-suit/:toolName`
- Method: `POST`
- Auth: **Required** (`Authorization: Bearer <JWT_TOKEN>`)
- Content-Type: `application/json`

---

## 1) Index Checker

- Tool name: `index-checker`
- Endpoint: `POST /seo-suit/index-checker`

### Request body
```json
{
  "url": "https://example.com/"
}
```

### Response (example)
```json
{
  "domain": "example.com",
  "total_engines": 4,
  "quick_submit_tip": "Request indexing in Search Console and submit your sitemap after content updates.",
  "google_index_status": "Indexed",
  "search_engines": [
    {
      "name": "Google",
      "status": "Indexed",
      "check_url": "https://www.google.com/search?q=%22https%3A%2F%2Fexample.com%2F%22&num=10&hl=en",
      "submit_url": "https://search.google.com/search-console/indexing/submit",
      "instructions": [
        "Open Google Search Console.",
        "Go to URL Inspection.",
        "Paste your homepage URL.",
        "Click Request Indexing and wait for results."
      ]
    }
  ],
  "ping_services": [
    {
      "name": "IndexNow (Bing)",
      "url": "https://www.bing.com/indexnow",
      "instructions": "Ping IndexNow after sitemap updates (implementation later)."
    }
  ]
}
```

---

## 2) Bulk Backlink Submitter

- Tool name: `bulk-submit`
- Endpoint: `POST /seo-suit/bulk-submit`

### Request body
```json
{
  "website_url": "https://yourwebsite.com",
  "website_name": "Your Website Name",
  "website_description": "Short natural description of your website/business.",
  "category": "Technology",
  "email": "contact@yourwebsite.com"
}
```

### Response (example)
```json
{
  "success": true,
  "website_url": "https://yourwebsite.com",
  "total_directories": 8,
  "priority_directories": 6,
  "submissions": [
    {
      "directory": "Product Hunt",
      "url": "https://www.producthunt.com/posts/new",
      "da": 90,
      "category": "Technology",
      "dofollow": true,
      "status": "ready",
      "instructions": "Launch your product and include a clear project description.",
      "submission_data": {
        "website_url": "https://yourwebsite.com",
        "website_name": "Your Website Name",
        "website_description": "Short natural description of your website/business.",
        "description": "Short natural description of your website/business.",
        "category": "Technology",
        "email": "contact@yourwebsite.com"
      }
    }
  ],
  "by_category": {
    "Technology": []
  },
  "priority_list": [],
  "tips": [
    "Start with high DA directories (90+) for maximum SEO impact",
    "Dofollow links pass more SEO value than nofollow",
    "Use consistent NAP (Name, Address, Phone) across all submissions",
    "Complete your profile fully on each platform",
    "Add your website description naturally without keyword stuffing"
  ]
}
```

---

## 3) Meta Tag Analyzer

- Tool name: `meta`
- Endpoint: `POST /seo-suit/meta`

### Request body
```json
{
  "url": "https://example.com"
}
```

### Response (example)
```json
{
  "url": "https://example.com/",
  "meta_tags": {
    "title": "Example Domain",
    "description": "Example description",
    "keywords": null,
    "robots": null,
    "canonical": "https://example.com/",
    "og": {
      "og:title": "Example Domain"
    },
    "twitter": {},
    "other": []
  },
  "title_length": 14,
  "description_length": 19,
  "issues": [
    {
      "type": "warning",
      "field": "description",
      "message": "Description too short (< 120 chars)"
    }
  ],
  "score": 95
}
```

---

## 4) SEO Score Calculator

- Tool name: `score`
- Endpoint: `POST /seo-suit/score`

### Request body
```json
{
  "url": "https://example.com"
}
```

### Response (example)
```json
{
  "url": "https://example.com/",
  "score": 78,
  "grade": "B",
  "breakdown": {
    "title": 16,
    "meta_description": 15,
    "heading_structure": 14,
    "content_quality": 13,
    "internal_links": 12,
    "image_optimization": 10,
    "mobile_friendly": 12,
    "performance": 11
  },
  "issues": [],
  "recommendations": []
}
```

---

## 5) Sitemap Generator

- Tool name: `sitemap`
- Endpoint: `POST /seo-suit/sitemap`

### Request body
```json
{
  "url": "https://example.com",
  "max_pages": 20
}
```

### Response (example)
```json
{
  "success": true,
  "urls_found": 3,
  "sitemap_xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">...</urlset>",
  "urls": [
    {
      "loc": "https://example.com/",
      "lastmod": "2026-03-24",
      "changefreq": "weekly",
      "priority": "1.0"
    }
  ]
}
```

---

## 6) Robots.txt Generator

- Tool name: `robots`
- Endpoint: `POST /seo-suit/robots`

### Request body
```json
{
  "domain": "example.com",
  "allow_paths": ["/", "/blog"],
  "disallow_paths": ["/admin", "/private", "/api"],
  "sitemap_url": "https://example.com/sitemap.xml",
  "crawl_delay": 10
}
```

### Response (example)
```json
{
  "success": true,
  "robots_txt": "# Robots.txt generated by TrafficBoxes SEO Suite\nUser-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: https://example.com/sitemap.xml\n",
  "domain": "example.com"
}
```

---

## 7) HTTP Headers Analyzer

- Tool name: `headers`
- Endpoint: `POST /seo-suit/headers`

### Request body
```json
{
  "url": "https://example.com"
}
```

### Response (example)
```json
{
  "url": "https://example.com/",
  "status_code": 200,
  "security_headers": {
    "Strict-Transport-Security": { "present": true, "value": "max-age=31536000", "recommended": true },
    "Content-Security-Policy": { "present": false, "value": null, "recommended": true }
  },
  "score": 67,
  "all_headers": {
    "content-type": "text/html; charset=UTF-8"
  }
}
```

---

## 8) Broken Link Checker

- Tool name: `links`
- Endpoint: `POST /seo-suit/links`

### Request body
```json
{
  "url": "https://example.com"
}
```

### Response (example)
```json
{
  "url": "https://example.com/",
  "total_links": 12,
  "broken_count": 2,
  "redirect_count": 1,
  "broken_links": [
    {
      "url": "https://example.com/missing",
      "text": "Missing page",
      "status": 404
    }
  ],
  "redirects": [
    {
      "url": "https://example.com/old-page",
      "text": "Old page",
      "status": 301,
      "redirect_to": "https://example.com/new-page"
    }
  ],
  "all_links": []
}
```

---

## 9) SSL Checker

- Tool name: `ssl`
- Endpoint: `POST /seo-suit/ssl`

### Request body
```json
{
  "url": "https://example.com"
}
```

### Response (example)
```json
{
  "valid": true,
  "hostname": "example.com",
  "issuer": {
    "organizationName": "Let's Encrypt",
    "commonName": "R10"
  },
  "subject": {
    "commonName": "example.com"
  },
  "not_before": "2026-01-01T00:00:00.000Z",
  "not_after": "2026-04-01T00:00:00.000Z",
  "days_until_expiry": 10,
  "expired": false,
  "expiring_soon": true,
  "version": 3,
  "serial_number": "1234"
}
```

If SSL fails:
```json
{
  "valid": false,
  "hostname": "example.com",
  "error": "SSL connection timeout"
}
```

---

## 10) Domain Age Checker

- Tool name: `domain`
- Endpoint: `POST /seo-suit/domain`

### Request body
```json
{
  "url": "https://example.com"
}
```

### Response (example)
```json
{
  "domain": "example.com",
  "creation_date": "1995-08-13T04:00:00.000Z",
  "age_days": 11111,
  "age_years": 30,
  "age_months": 5,
  "age_text": "30 years, 5 months"
}
```

If lookup fails:
```json
{
  "domain": "example.com",
  "error": "Creation date not found"
}
```

---

## 11) DNS Records Lookup

- Tool name: `dns`
- Endpoint: `POST /seo-suit/dns`

### Request body
```json
{
  "url": "https://example.com"
}
```

### Response (example)
```json
{
  "domain": "example.com",
  "records": {
    "A": ["93.184.216.34"],
    "AAAA": [],
    "MX": [],
    "NS": ["a.iana-servers.net", "b.iana-servers.net"],
    "TXT": ["v=spf1 -all"],
    "CNAME": [],
    "SOA": ["nsname=a.iana-servers.net; hostmaster=..."]
  }
}
```

---

## 12) Schema Markup Generator

- Tool name: `schema`
- Endpoint: `POST /seo-suit/schema`

### Request body
```json
{
  "schema_type": "Article",
  "data": {
    "headline": "My Article",
    "author": "John Doe",
    "datePublished": "2026-03-01",
    "dateModified": "2026-03-24",
    "image": "https://example.com/cover.jpg",
    "publisher": "TrafficBoxes",
    "logo": "https://example.com/logo.png"
  }
}
```

### Response (example)
```json
{
  "schema_type": "Article",
  "json_ld": "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"Article\"\n}",
  "html": "<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\"\n}\n</script>"
}
```

---

## Error responses

### Missing/invalid auth
```json
{
  "error": "No token or malformed token"
}
```

### Unknown tool
```json
{
  "detail": "Unknown SEO tool: <toolName>"
}
```

