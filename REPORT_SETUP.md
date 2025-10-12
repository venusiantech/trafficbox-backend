# PDF Report Generation Setup

This feature generates beautiful PDF reports for campaigns with charts and analytics.

## Installation

1. Install the new dependency:
```bash
npm install puppeteer
```

2. If running in Docker/Linux, you may need additional dependencies:
```bash
# Ubuntu/Debian
apt-get update && apt-get install -y \
    chromium-browser \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils
```

## Usage

### Generate Campaign Report

```http
GET /api/campaigns/{campaignId}/report.pdf
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `from` (optional): Start date in YYYY-MM-DD format
- `to` (optional): End date in YYYY-MM-DD format
- `include_archived` (optional): Include archived campaigns

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:5000/api/campaigns/64a7b8c9d1e2f3g4h5i6j7k8/report.pdf?from=2024-01-01&to=2024-01-31" \
     --output campaign-report.pdf
```

## Report Features

The generated PDF includes:

### 📊 **Visual Analytics**
- **Daily Performance Chart**: Line graph showing hits and visits over time
- **Country Distribution Chart**: Doughnut chart showing traffic by country
- **Professional Design**: Modern, clean layout with branded styling

### 📈 **Key Performance Indicators**
- Total Hits
- Total Visits  
- Average Daily Hits
- Active Days
- Top Country

### 📋 **Detailed Tables**
- **Daily Breakdown**: Date-wise hits, visits, and hit rate percentage
- **Country Analysis**: Country-wise traffic distribution with percentages

### 🎨 **Design Features**
- Professional header with gradient background
- Interactive hover effects
- Responsive grid layout
- High-quality charts using Chart.js
- Print-optimized styling

## Technical Details

- **Engine**: Puppeteer with headless Chrome
- **Charts**: Chart.js for beautiful visualizations
- **Styling**: Modern CSS with Inter font family
- **Format**: A4 PDF with print-friendly margins
- **Performance**: Optimized for fast generation

## Troubleshooting

### Common Issues

1. **Puppeteer fails to launch Chrome**
   - Add launch args: `--no-sandbox --disable-setuid-sandbox`
   - Install system dependencies listed above

2. **Charts not rendering**
   - Ensure `networkidle0` wait condition
   - Check internet connection for Chart.js CDN

3. **Memory issues**
   - Use `--disable-dev-shm-usage` flag
   - Ensure proper browser cleanup

### Environment Variables

No additional environment variables needed. The report service automatically:
- Fetches data from SparkTraffic API using existing `SPARKTRAFFIC_API_KEY`
- Uses campaign configuration for country targeting
- Generates date ranges automatically if not specified

## Security

- **Authentication**: Requires valid JWT token
- **Authorization**: Users can only access their own campaigns (admins can access all)
- **Archived Campaigns**: Blocked by default unless explicitly requested
- **Input Validation**: Date format validation and parameter sanitization
