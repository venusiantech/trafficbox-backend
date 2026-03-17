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

function UpgradeEmail({
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
            React.createElement(Text, { style: styles.badge }, "🚀 Plan Upgraded"),
            React.createElement(Text, { style: styles.greeting },
              `You're now on the ${newPlan} plan!`
            ),
            React.createElement(Text, { style: styles.paragraph },
              `Hi ${firstName}, great news! You've successfully upgraded your plan from ${oldPlan ? oldPlan.charAt(0).toUpperCase() + oldPlan.slice(1) : "your previous plan"} to ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}.`
            ),
            React.createElement(Section, { style: styles.planBox },
              React.createElement(Text, { style: styles.planTitle }, newPlan.toUpperCase() + " PLAN — NOW ACTIVE"),
              visitsIncluded && React.createElement(Text, { style: styles.planDetail }, `🚀 ${Number(visitsIncluded).toLocaleString()} visits / month`),
              campaignLimit && React.createElement(Text, { style: styles.planDetail }, `📁 Up to ${campaignLimit} campaigns`),
              formattedDate && React.createElement(Text, { style: styles.planDetail }, `📅 Renews on ${formattedDate}`)
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, { href: process.env.FRONTEND_URL || "https://trafficboxes.com/dashboard", style: styles.button },
              "Start Using Your New Plan"
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
  badge: { display: "inline-block", backgroundColor: "#ede9fe", color: "#5b21b6", fontSize: "13px", fontWeight: "600", padding: "4px 12px", borderRadius: "20px", margin: "0 0 16px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#444", lineHeight: "1.6", margin: "0 0 20px" },
  planBox: { backgroundColor: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "8px", padding: "20px" },
  planTitle: { fontSize: "12px", fontWeight: "700", color: "#7c3aed", letterSpacing: "1px", margin: "0 0 12px" },
  planDetail: { fontSize: "15px", color: "#333", margin: "6px 0", lineHeight: "1.5" },
  hr: { borderColor: "#e8ecef", margin: "24px 0" },
  button: { backgroundColor: "#7c3aed", color: "#ffffff", fontSize: "15px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "6px", display: "inline-block" },
  footer: { fontSize: "13px", color: "#999", margin: "8px 0", lineHeight: "1.5" },
};

module.exports = UpgradeEmail;
