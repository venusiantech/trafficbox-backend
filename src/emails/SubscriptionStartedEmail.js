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

function SubscriptionStartedEmail({
  firstName = "there",
  planName = "Starter",
  amount,
  visitsIncluded,
  campaignLimit,
  periodEnd,
}) {
  const formattedAmount = amount ? `$${(amount / 100).toFixed(2)}` : null;
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
            React.createElement(Text, { style: styles.label }, "Payment Confirmed"),
            React.createElement(Text, { style: styles.greeting },
              `Your ${planName} plan is active`
            ),
            React.createElement(Text, { style: styles.paragraph },
              `Hi ${firstName}, your subscription has been successfully activated. Below is a summary of your plan.`
            ),
            React.createElement(Section, { style: styles.planBox },
              React.createElement(Text, { style: styles.planTitle },
                planName.toUpperCase() + " PLAN"
              ),
              React.createElement(Hr, { style: styles.innerHr }),
              visitsIncluded && React.createElement(Text, { style: styles.planRow },
                React.createElement("span", { style: styles.planKey }, "Monthly visits"),
                React.createElement("span", { style: styles.planVal }, Number(visitsIncluded).toLocaleString())
              ),
              campaignLimit && React.createElement(Text, { style: styles.planRow },
                React.createElement("span", { style: styles.planKey }, "Campaign limit"),
                React.createElement("span", { style: styles.planVal }, campaignLimit)
              ),
              formattedAmount && React.createElement(Text, { style: styles.planRow },
                React.createElement("span", { style: styles.planKey }, "Amount charged"),
                React.createElement("span", { style: styles.planVal }, formattedAmount)
              ),
              formattedDate && React.createElement(Text, { style: styles.planRow },
                React.createElement("span", { style: styles.planKey }, "Active until"),
                React.createElement("span", { style: styles.planVal }, formattedDate)
              )
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, { href: process.env.FRONTEND_URL || "https://trafficboxes.com/dashboard", style: styles.button },
              "Go to Dashboard"
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "For billing questions, contact us at connect@trafficboxes.com"
            ),
            React.createElement(Text, { style: styles.footer }, "TrafficBoxes  |  All rights reserved.")
          )
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
  label: { display: "inline-block", backgroundColor: "#dcfce7", color: "#166534", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.6px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#111827", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#4b5563", lineHeight: "1.6", margin: "0 0 24px" },
  planBox: { border: "1px solid #e5e7eb", borderRadius: "6px", padding: "20px 24px" },
  planTitle: { fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.8px", textTransform: "uppercase", margin: "0 0 12px" },
  innerHr: { borderColor: "#f3f4f6", margin: "0 0 14px" },
  planRow: { fontSize: "14px", color: "#374151", margin: "8px 0", display: "flex", justifyContent: "space-between" },
  planKey: { color: "#6b7280" },
  planVal: { fontWeight: "600", color: "#111827" },
  hr: { borderColor: "#e5e7eb", margin: "28px 0" },
  button: { backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = SubscriptionStartedEmail;
