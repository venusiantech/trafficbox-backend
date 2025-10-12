const Campaign = require("../models/Campaign");
const CampaignDailyStat = require("../models/CampaignDailyStat");
const puppeteer = require("puppeteer");
const axios = require("axios");

/**
 * Fetches and processes campaign statistics for report generation
 */
async function getCampaignStatsForReport(campaignId, { from, to }) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Parse date range
  const toDate = to ? new Date(to + "T23:59:59.999Z") : new Date();
  const fromDate = from
    ? new Date(from + "T00:00:00.000Z")
    : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  // Get SparkTraffic stats if available
  let sparkTrafficStats = null;
  if (campaign.spark_traffic_project_id) {
    try {
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
      if (API_KEY) {
        const statsResp = await axios.post(
          "https://v2.sparktraffic.com/get-website-traffic-project-stats",
          null,
          {
            headers: {
              "Content-Type": "application/json",
              API_KEY,
            },
            params: {
              unique_id: campaign.spark_traffic_project_id,
              from: from || fromDate.toISOString().split("T")[0],
              to: to || toDate.toISOString().split("T")[0],
            },
          }
        );
        sparkTrafficStats = statsResp.data;
      }
    } catch (error) {
      console.warn("Failed to fetch SparkTraffic stats:", error.message);
    }
  }

  // Process daily statistics
  const dailyStats = [];
  let totalHits = 0;
  let totalVisits = 0;
  const countryTotals = new Map();

  if (sparkTrafficStats) {
    // Process hits data
    if (Array.isArray(sparkTrafficStats.hits)) {
      sparkTrafficStats.hits.forEach((dayData) => {
        Object.entries(dayData).forEach(([date, hits]) => {
          const hitCount = parseInt(hits) || 0;
          totalHits += hitCount;

          const existingDay = dailyStats.find((d) => d.date === date);
          if (existingDay) {
            existingDay.hits += hitCount;
          } else {
            dailyStats.push({
              date,
              hits: hitCount,
              visits: 0,
            });
          }
        });
      });
    }

    // Process visits data
    if (Array.isArray(sparkTrafficStats.visits)) {
      sparkTrafficStats.visits.forEach((dayData) => {
        Object.entries(dayData).forEach(([date, visits]) => {
          const visitCount = parseInt(visits) || 0;
          totalVisits += visitCount;

          const existingDay = dailyStats.find((d) => d.date === date);
          if (existingDay) {
            existingDay.visits += visitCount;
          } else {
            dailyStats.push({
              date,
              hits: 0,
              visits: visitCount,
            });
          }
        });
      });
    }
  }

  // Sort daily stats by date
  dailyStats.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Get country breakdown from campaign configuration
  let countryBreakdown = [];
  if (Array.isArray(campaign.countries) && campaign.countries.length > 0) {
    if (
      typeof campaign.countries[0] === "object" &&
      campaign.countries[0].country
    ) {
      // New format: array of {country, percent}
      countryBreakdown = campaign.countries.map((c) => ({
        country: c.country,
        percent: c.percent || 0,
        hits: Math.round(totalHits * (c.percent || 0)),
        visits: Math.round(totalVisits * (c.percent || 0)),
      }));
    } else if (typeof campaign.countries[0] === "string") {
      // Old format: array of country codes - distribute equally
      const equalPercent = 1 / campaign.countries.length;
      countryBreakdown = campaign.countries.map((country) => ({
        country,
        percent: equalPercent,
        hits: Math.round(totalHits * equalPercent),
        visits: Math.round(totalVisits * equalPercent),
      }));
    }
  }

  return {
    campaign: {
      id: campaign._id,
      title: campaign.title || "Untitled Campaign",
      url: campaign.urls && campaign.urls[0] ? campaign.urls[0] : "N/A",
      createdAt: campaign.createdAt,
      state: campaign.state,
    },
    dateRange: {
      from: from || fromDate.toISOString().split("T")[0],
      to: to || toDate.toISOString().split("T")[0],
    },
    summary: {
      totalHits,
      totalVisits,
      avgDailyHits:
        dailyStats.length > 0 ? Math.round(totalHits / dailyStats.length) : 0,
      activeDays: dailyStats.filter((d) => d.hits > 0 || d.visits > 0).length,
      topCountry:
        countryBreakdown.length > 0
          ? countryBreakdown.sort((a, b) => b.percent - a.percent)[0].country
          : "N/A",
    },
    dailyStats,
    countryBreakdown,
  };
}

/**
 * Generates HTML template for the PDF report
 */
function generateHTMLTemplate(data) {
  const { campaign, dateRange, summary, dailyStats, countryBreakdown } = data;

  // Prepare chart data
  const chartDates = dailyStats.map((d) => d.date);
  const chartHits = dailyStats.map((d) => d.hits);
  const chartVisits = dailyStats.map((d) => d.visits);

  const countryLabels = countryBreakdown.map((c) => c.country);
  const countryPercentages = countryBreakdown.map((c) =>
    (c.percent * 100).toFixed(1)
  );
  const countryColors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#0ea5e9",
    "#ef4444",
    "#14b8a6",
    "#f43f5e",
    "#22c55e",
  ];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Campaign Report - ${campaign.title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            color: #e2e8f0;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            line-height: 1.6;
            min-height: 100vh;
            margin: 0;
            padding: 0;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 30px;
        }
        
        /* Page Break Controls */
        .page-break {
            page-break-before: always;
        }
        
        .no-break {
            page-break-inside: avoid;
        }
        
        .header {
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #06b6d4 100%);
            color: white;
            padding: 40px 30px;
            border-radius: 20px;
            margin-bottom: 30px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            page-break-inside: avoid;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -10%;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
            border-radius: 50%;
        }
        
        .header::after {
            content: '';
            position: absolute;
            bottom: -20%;
            left: -10%;
            width: 200px;
            height: 200px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 50%;
        }
        
        .header h1 {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header .subtitle {
            font-size: 16px;
            opacity: 0.95;
            position: relative;
            z-index: 1;
            font-weight: 500;
            margin-bottom: 15px;
        }
        
        .header .meta {
            margin-top: 20px;
            font-size: 13px;
            opacity: 0.85;
            position: relative;
            z-index: 1;
            background: rgba(255, 255, 255, 0.1);
            padding: 10px 18px;
            border-radius: 25px;
            backdrop-filter: blur(10px);
            display: inline-block;
        }
        
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .kpi-card {
            background: linear-gradient(145deg, #1e293b 0%, #334155 100%);
            border: 1px solid rgba(94, 234, 212, 0.2);
            border-radius: 14px;
            padding: 20px 16px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            min-height: 100px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6);
        }
        
        .kpi-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            border-color: rgba(94, 234, 212, 0.4);
        }
        
        .kpi-value {
            font-size: 24px;
            font-weight: 800;
            background: linear-gradient(135deg, #06b6d4, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 6px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            line-height: 1.2;
        }
        
        .kpi-label {
            font-size: 11px;
            color: #94a3b8;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            line-height: 1.2;
        }
        
        .charts-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: 65% 35%;
            gap: 25px;
            margin-bottom: 30px;
        }
        
        .chart-container {
            background: linear-gradient(145deg, #1e293b 0%, #334155 100%);
            border: 1px solid rgba(94, 234, 212, 0.15);
            border-radius: 14px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
            page-break-inside: avoid;
        }
        
        .chart-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #06b6d4, #8b5cf6);
        }
        
        .chart-title {
            font-size: 16px;
            font-weight: 700;
            color: #f1f5f9;
            margin-bottom: 18px;
            text-align: center;
        }
        
        .table-section {
            background: linear-gradient(145deg, #1e293b 0%, #334155 100%);
            border: 1px solid rgba(94, 234, 212, 0.15);
            border-radius: 14px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            margin-bottom: 25px;
            position: relative;
            overflow: hidden;
            page-break-inside: avoid;
        }
        
        .table-section.page-break-before {
            page-break-before: always;
            margin-top: 0;
        }
        
        .table-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #3b82f6, #06b6d4);
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 700;
            color: #f1f5f9;
            margin-bottom: 20px;
            text-align: center;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            background: rgba(15, 23, 42, 0.5);
            border-radius: 10px;
            overflow: hidden;
        }
        
        th {
            background: linear-gradient(135deg, #475569 0%, #334155 100%);
            color: #f1f5f9;
            font-weight: 700;
            padding: 12px 16px;
            text-align: left;
            border-bottom: 2px solid rgba(94, 234, 212, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 11px;
        }
        
        td {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(71, 85, 105, 0.3);
            color: #cbd5e1;
            font-weight: 500;
        }
        
        tr:nth-child(even) {
            background: rgba(30, 41, 59, 0.3);
        }
        
        tr:hover {
            background: rgba(59, 130, 246, 0.1);
            transform: scale(1.01);
            transition: all 0.2s ease;
        }
        
        .text-right {
            text-align: right;
        }
        
        .footer {
            text-align: center;
            color: #64748b;
            font-size: 11px;
            margin-top: 30px;
            padding: 20px;
            background: rgba(15, 23, 42, 0.5);
            border-radius: 10px;
            border: 1px solid rgba(71, 85, 105, 0.3);
            page-break-inside: avoid;
        }
        
        .footer p {
            margin-bottom: 6px;
        }
        
        /* Enhanced animations and effects */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .kpi-card, .chart-container, .table-section {
            animation: fadeInUp 0.4s ease-out;
        }
        
        /* Responsive grid adjustments */
        @media (max-width: 768px) {
            .kpi-grid {
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
            }
            
            .charts-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }
        }
        
        /* Print optimizations */
        @media print {
            body { 
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
                font-size: 12px;
            }
            
            .container { 
                padding: 15px;
                max-width: 100%;
            }
            
            .header {
                padding: 25px 20px;
                margin-bottom: 20px;
            }
            
            .kpi-grid {
                margin-bottom: 20px;
                gap: 15px;
            }
            
            .charts-grid {
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .table-section {
                margin-bottom: 20px;
                padding: 20px;
            }
            
            .chart-container {
                padding: 15px;
            }
            
            .page-break {
                page-break-before: always;
            }
            
            .no-break {
                page-break-inside: avoid;
            }
            
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Page 1: Header and KPIs -->
        <div class="header no-break">
            <h1>📊 Campaign Performance Report</h1>
            <div class="subtitle">${campaign.title}</div>
            <div class="meta">
                📅 Period: ${dateRange.from} to ${dateRange.to} • 
                🗓️ Generated: ${new Date().toLocaleDateString()} • 
                🆔 Campaign ID: ${campaign.id}
            </div>
        </div>
        
        <div class="kpi-grid no-break">
            <div class="kpi-card">
                <div class="kpi-value">${summary.totalHits.toLocaleString()}</div>
                <div class="kpi-label">Total Hits</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${summary.totalVisits.toLocaleString()}</div>
                <div class="kpi-label">Total Visits</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${summary.avgDailyHits.toLocaleString()}</div>
                <div class="kpi-label">Avg Daily Hits</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${summary.activeDays}</div>
                <div class="kpi-label">Active Days</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${summary.topCountry}</div>
                <div class="kpi-label">Top Country</div>
            </div>
        </div>
        
        <!-- Charts Section -->
        <div class="charts-grid no-break">
            <div class="chart-container">
                <div class="chart-title">📈 Daily Performance Trend</div>
                <canvas id="lineChart" height="280"></canvas>
            </div>
            <div class="chart-container">
                <div class="chart-title">🌍 Traffic by Country</div>
                <canvas id="pieChart" height="280"></canvas>
            </div>
        </div>
        
        <!-- Page 2: Daily Performance Table -->
        <div class="table-section page-break-before">
            <div class="section-title">📋 Daily Performance Breakdown</div>
            <table>
                <thead>
                    <tr>
                        <th>📅 Date</th>
                        <th class="text-right">🎯 Hits</th>
                        <th class="text-right">👥 Visits</th>
                        <th class="text-right">📊 Hit Rate %</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailyStats
                      .map((day) => {
                        const hitRate =
                          summary.totalHits > 0
                            ? ((day.hits / summary.totalHits) * 100).toFixed(1)
                            : "0.0";
                        return `
                        <tr>
                            <td>${day.date}</td>
                            <td class="text-right">${day.hits.toLocaleString()}</td>
                            <td class="text-right">${day.visits.toLocaleString()}</td>
                            <td class="text-right">${hitRate}%</td>
                        </tr>
                        `;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <!-- Country Distribution Table -->
        <div class="table-section">
            <div class="section-title">🌎 Geographic Distribution</div>
            <table>
                <thead>
                    <tr>
                        <th>🏳️ Country</th>
                        <th class="text-right">📊 Percentage</th>
                        <th class="text-right">🎯 Est. Hits</th>
                        <th class="text-right">👥 Est. Visits</th>
                    </tr>
                </thead>
                <tbody>
                    ${countryBreakdown
                      .map(
                        (country) => `
                    <tr>
                        <td>${country.country}</td>
                        <td class="text-right">${(
                          country.percent * 100
                        ).toFixed(1)}%</td>
                        <td class="text-right">${country.hits.toLocaleString()}</td>
                        <td class="text-right">${country.visits.toLocaleString()}</td>
                    </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>🔒 This report is confidential and generated by TrafficBox Analytics Platform</p>
            <p>🌐 Campaign URL: ${campaign.url} • 📊 Status: ${
    campaign.state || "Unknown"
  } • ⚡ Powered by SparkTraffic</p>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        // Line Chart for Daily Performance
        const lineCtx = document.getElementById('lineChart').getContext('2d');
        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(chartDates)},
                datasets: [
                    {
                        label: 'Hits',
                        data: ${JSON.stringify(chartHits)},
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#06b6d4',
                        pointBorderColor: '#0f172a',
                        pointBorderWidth: 3,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointHoverBackgroundColor: '#67e8f9',
                        pointHoverBorderColor: '#0f172a',
                        pointHoverBorderWidth: 3
                    },
                    {
                        label: 'Visits',
                        data: ${JSON.stringify(chartVisits)},
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#8b5cf6',
                        pointBorderColor: '#0f172a',
                        pointBorderWidth: 3,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointHoverBackgroundColor: '#c4b5fd',
                        pointHoverBorderColor: '#0f172a',
                        pointHoverBorderWidth: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            font: {
                                size: 13,
                                weight: '600',
                                family: 'Inter'
                            },
                            color: '#e2e8f0',
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#cbd5e1',
                        borderColor: '#06b6d4',
                        borderWidth: 1,
                        cornerRadius: 8,
                        titleFont: {
                            size: 13,
                            weight: '600'
                        },
                        bodyFont: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(71, 85, 105, 0.3)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11,
                                weight: '500'
                            },
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(71, 85, 105, 0.3)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11,
                                weight: '500'
                            },
                            color: '#94a3b8'
                        }
                    }
                }
            }
        });
        
        // Pie Chart for Country Distribution
        const pieCtx = document.getElementById('pieChart').getContext('2d');
        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(countryLabels)},
                datasets: [{
                    data: ${JSON.stringify(countryPercentages)},
                    backgroundColor: [
                        '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', 
                        '#10b981', '#3b82f6', '#ef4444', '#14b8a6', 
                        '#f43f5e', '#22c55e'
                    ],
                    borderWidth: 3,
                    borderColor: '#0f172a',
                    hoverBorderWidth: 4,
                    hoverBorderColor: '#1e293b',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12,
                                weight: '600',
                                family: 'Inter'
                            },
                            color: '#e2e8f0'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#cbd5e1',
                        borderColor: '#06b6d4',
                        borderWidth: 1,
                        cornerRadius: 8,
                        titleFont: {
                            size: 13,
                            weight: '600'
                        },
                        bodyFont: {
                            size: 12,
                            weight: '500'
                        },
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>
  `;
}

/**
 * Generates a PDF report for a campaign
 */
async function generateCampaignReportPDF(campaignId, options = {}) {
  try {
    // Get campaign statistics
    const statsData = await getCampaignStatsForReport(campaignId, options);

    // Generate HTML
    const html = generateHTMLTemplate(statsData);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    // Set content and wait for charts to render
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        bottom: "20px",
        left: "20px",
        right: "20px",
      },
    });

    await browser.close();

    return pdfBuffer;
  } catch (error) {
    console.error("Error generating PDF report:", error);
    throw error;
  }
}

module.exports = {
  generateCampaignReportPDF,
  getCampaignStatsForReport,
};
