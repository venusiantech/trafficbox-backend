const React = require("react");
const {
  Html,
  Head,
  Body,
  Container,
  Section,
  Row,
  Column,
  Text,
  Button,
  Hr,
} = require("@react-email/components");

function CustomPlanEmail({
  firstName = "there",
  visitsIncluded,
  campaignLimit,
  durationDays = 365,
  price,
  description,
  paymentLink,
}) {
  const requiresPayment = !!paymentLink;
  const formattedPrice = price != null && price > 0 ? `$${Number(price).toFixed(2)}` : null;

  const rows = [
    visitsIncluded && { label: "Monthly visits", value: Number(visitsIncluded).toLocaleString() },
    campaignLimit && { label: "Campaign limit", value: String(campaignLimit) },
    { label: "Valid for", value: `${durationDays} days` },
    formattedPrice && { label: "Amount", value: formattedPrice },
    description && { label: "Notes", value: description },
  ].filter(Boolean);

  return (
    React.createElement(Html, null,
      React.createElement(Head, null),
      React.createElement(Body, { style: styles.body },
        React.createElement(Container, { style: styles.container },
          React.createElement(Section, { style: styles.header },
            React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
          ),
          React.createElement(Section, { style: styles.content },
            React.createElement(Text, { style: styles.label },
              requiresPayment ? "Payment Required" : "Plan Activated"
            ),
            React.createElement(Text, { style: styles.greeting },
              requiresPayment
                ? "Your custom plan is ready"
                : "Your custom plan is now active"
            ),
            React.createElement(Text, { style: styles.paragraph },
              requiresPayment
                ? `Hi ${firstName}, your custom plan has been configured by our team. Complete your payment below to activate it.`
                : `Hi ${firstName}, your custom plan has been activated. You can start using it immediately from your dashboard.`
            ),
            React.createElement(Section, { style: styles.planBox },
              React.createElement(Text, { style: styles.planTitle }, "CUSTOM PLAN DETAILS"),
              React.createElement(Hr, { style: styles.innerHr }),
              ...rows.map((row) =>
                React.createElement(Row, { style: styles.row, key: row.label },
                  React.createElement(Column, { style: styles.keyCol }, row.label),
                  React.createElement(Column, { style: styles.valCol }, row.value)
                )
              )
            ),
            requiresPayment && React.createElement(Text, { style: styles.payNote },
              "This plan will be activated automatically once payment is complete. The payment link below is secure and expires after use."
            ),
            React.createElement(Hr, { style: styles.hr }),
            requiresPayment
              ? React.createElement(Button, { href: paymentLink, style: styles.payButton },
                  formattedPrice ? `Complete Payment — ${formattedPrice}` : "Complete Payment"
                )
              : React.createElement(Button, { href: process.env.FRONTEND_URL || "https://trafficboxes.com/dashboard", style: styles.button },
                  "Go to Dashboard"
                ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "For questions about your plan, contact us at connect@trafficboxes.com"
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
  planBox: { border: "1px solid #e5e7eb", borderRadius: "6px", padding: "20px 24px", marginBottom: "20px" },
  planTitle: { fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.8px", textTransform: "uppercase", margin: "0 0 12px" },
  innerHr: { borderColor: "#f3f4f6", margin: "0 0 8px" },
  row: { width: "100%" },
  keyCol: { fontSize: "14px", color: "#6b7280", paddingTop: "8px", paddingBottom: "8px", width: "55%" },
  valCol: { fontSize: "14px", fontWeight: "600", color: "#111827", paddingTop: "8px", paddingBottom: "8px", textAlign: "right" },
  payNote: { fontSize: "14px", color: "#6b7280", lineHeight: "1.6", margin: "0 0 4px" },
  hr: { borderColor: "#e5e7eb", margin: "28px 0" },
  button: { backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  payButton: { backgroundColor: "#065f46", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = CustomPlanEmail;
