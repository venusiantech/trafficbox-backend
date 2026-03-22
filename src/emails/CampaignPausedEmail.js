const React = require("react");
const {
  Html, Head, Body, Container, Section, Row, Column, Text, Button, Hr,
} = require("@react-email/components");

function CampaignPausedEmail({ firstName = "there", campaignTitle = "Your Campaign", visitsIncluded, visitsUsed }) {
  const formattedIncluded = visitsIncluded ? Number(visitsIncluded).toLocaleString() : null;
  const formattedUsed = visitsUsed ? Number(visitsUsed).toLocaleString() : null;

  return React.createElement(Html, null,
    React.createElement(Head, null),
    React.createElement(Body, { style: styles.body },
      React.createElement(Container, { style: styles.container },
        React.createElement(Section, { style: styles.header },
          React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
        ),
        React.createElement(Section, { style: styles.content },
          React.createElement(Text, { style: styles.label }, "Campaign Paused"),
          React.createElement(Text, { style: styles.greeting }, "Your campaign has been paused"),
          React.createElement(Text, { style: styles.paragraph },
            `Hi ${firstName}, your campaign "${campaignTitle}" has been automatically paused because your visit balance has been fully used.`
          ),
          (formattedIncluded || formattedUsed) && React.createElement(Section, { style: styles.planBox },
            React.createElement(Text, { style: styles.planTitle }, "BALANCE SUMMARY"),
            React.createElement(Hr, { style: styles.innerHr }),
            formattedIncluded && React.createElement(Row, { style: styles.row },
              React.createElement(Column, { style: styles.keyCol }, "Total visits included"),
              React.createElement(Column, { style: styles.valCol }, formattedIncluded)
            ),
            formattedUsed && React.createElement(Row, { style: styles.row },
              React.createElement(Column, { style: styles.keyCol }, "Visits used"),
              React.createElement(Column, { style: styles.valColUsed }, formattedUsed)
            ),
            React.createElement(Row, { style: styles.row },
              React.createElement(Column, { style: styles.keyCol }, "Remaining"),
              React.createElement(Column, { style: styles.valColZero }, "0")
            )
          ),
          React.createElement(Text, { style: styles.paragraph },
            "To resume your campaign, top up your visit balance. Your campaign settings are saved and will restart immediately after top-up."
          ),
          React.createElement(Hr, { style: styles.hr }),
          React.createElement(Button, {
            href: `${process.env.FRONTEND_URL || "https://trafficboxes.com"}/dashboard?topup=true`,
            style: styles.button,
          }, "Top Up Visits"),
          React.createElement(Hr, { style: styles.hr }),
          React.createElement(Text, { style: styles.footer }, "For support, contact us at connect@trafficboxes.com"),
          React.createElement(Text, { style: styles.footer }, "TrafficBoxes  |  All rights reserved.")
        )
      )
    )
  );
}

const styles = {
  body: { backgroundColor: "#f4f4f5", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  container: { backgroundColor: "#ffffff", margin: "0 auto", padding: "0", maxWidth: "560px", borderRadius: "6px", overflow: "hidden" },
  header: { backgroundColor: "#111827", padding: "28px 40px" },
  logo: { color: "#ffffff", fontSize: "20px", fontWeight: "700", margin: "0", letterSpacing: "0.5px" },
  content: { padding: "40px" },
  label: { display: "inline-block", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.6px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#111827", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#4b5563", lineHeight: "1.6", margin: "0 0 20px" },
  planBox: { border: "1px solid #e5e7eb", borderRadius: "6px", padding: "20px 24px", marginBottom: "20px" },
  planTitle: { fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.8px", textTransform: "uppercase", margin: "0 0 12px" },
  innerHr: { borderColor: "#f3f4f6", margin: "0 0 8px" },
  row: { width: "100%" },
  keyCol: { fontSize: "14px", color: "#6b7280", paddingTop: "8px", paddingBottom: "8px", width: "55%" },
  valCol: { fontSize: "14px", fontWeight: "600", color: "#111827", paddingTop: "8px", paddingBottom: "8px", textAlign: "right" },
  valColUsed: { fontSize: "14px", fontWeight: "600", color: "#d97706", paddingTop: "8px", paddingBottom: "8px", textAlign: "right" },
  valColZero: { fontSize: "14px", fontWeight: "700", color: "#dc2626", paddingTop: "8px", paddingBottom: "8px", textAlign: "right" },
  hr: { borderColor: "#e5e7eb", margin: "24px 0" },
  button: { backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = CampaignPausedEmail;
