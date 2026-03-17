const React = require("react");
const {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} = require("@react-email/components");

function DowngradeEmail({
  firstName = "there",
  oldPlan = "",
  newPlan = "",
  visitsIncluded,
  campaignLimit,
  periodEnd,
}) {
  const formattedDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    React.createElement(Html, null,
      React.createElement(Head, null),
      React.createElement(Body, { style: styles.body },
        React.createElement(Container, { style: styles.container },
          React.createElement(Section, { style: styles.header },
            React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
          ),
          React.createElement(Section, { style: styles.content },
            React.createElement(Text, { style: styles.badge }, "Plan Changed"),
            React.createElement(Text, { style: styles.greeting },
              `Your plan has been changed to ${newPlan}`
            ),
            React.createElement(Text, { style: styles.paragraph },
              `Hi ${firstName}, your subscription has been updated from ${oldPlan ? oldPlan.charAt(0).toUpperCase() + oldPlan.slice(1) : "your previous plan"} to ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}.`
            ),
            React.createElement(Section, { style: styles.planBox },
              React.createElement(Text, { style: styles.planTitle }, newPlan.toUpperCase() + " PLAN — NOW ACTIVE"),
              visitsIncluded && React.createElement(Text, { style: styles.planDetail }, `🚀 ${Number(visitsIncluded).toLocaleString()} visits / month`),
              campaignLimit && React.createElement(Text, { style: styles.planDetail }, `📁 Up to ${campaignLimit} campaigns`),
              formattedDate && React.createElement(Text, { style: styles.planDetail }, `📅 Active until ${formattedDate}`)
            ),
            React.createElement(Text, { style: styles.paragraph },
              "If you'd like to upgrade again to unlock more features, you can do so any time from your dashboard."
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, { href: `${process.env.FRONTEND_URL || "https://trafficboxes.com"}/plans`, style: styles.button },
              "View All Plans"
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "Questions? Contact us at connect@trafficboxes.com"
            ),
            React.createElement(Text, { style: styles.footer }, "© TrafficBoxes. All rights reserved.")
          )
        )
      )
    )
  );
}

const styles = {
  body: { backgroundColor: "#f6f9fc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  container: { backgroundColor: "#ffffff", margin: "0 auto", padding: "0", maxWidth: "560px", borderRadius: "8px", overflow: "hidden" },
  header: { backgroundColor: "#1a1a2e", padding: "32px 40px" },
  logo: { color: "#ffffff", fontSize: "24px", fontWeight: "700", margin: "0" },
  content: { padding: "40px" },
  badge: { display: "inline-block", backgroundColor: "#f1f5f9", color: "#475569", fontSize: "13px", fontWeight: "600", padding: "4px 12px", borderRadius: "20px", margin: "0 0 16px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#444", lineHeight: "1.6", margin: "0 0 16px" },
  planBox: { backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "20px", marginBottom: "16px" },
  planTitle: { fontSize: "12px", fontWeight: "700", color: "#64748b", letterSpacing: "1px", margin: "0 0 12px" },
  planDetail: { fontSize: "15px", color: "#333", margin: "6px 0", lineHeight: "1.5" },
  hr: { borderColor: "#e8ecef", margin: "24px 0" },
  button: { backgroundColor: "#4f46e5", color: "#ffffff", fontSize: "15px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "6px", display: "inline-block" },
  footer: { fontSize: "13px", color: "#999", margin: "8px 0", lineHeight: "1.5" },
};

module.exports = DowngradeEmail;
