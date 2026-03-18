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

function TopUpEmail({
  firstName = "there",
  hitsAdded,
  amountPaid,
  newBalance,
}) {
  const formattedHits = hitsAdded ? Number(hitsAdded).toLocaleString() : null;
  const formattedBalance = newBalance ? Number(newBalance).toLocaleString() : null;
  const formattedAmount = amountPaid ? `$${Number(amountPaid).toFixed(2)}` : null;

  return (
    React.createElement(Html, null,
      React.createElement(Head, null),
      React.createElement(Body, { style: styles.body },
        React.createElement(Container, { style: styles.container },
          React.createElement(Section, { style: styles.header },
            React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
          ),
          React.createElement(Section, { style: styles.content },
            React.createElement(Text, { style: styles.label }, "Top-Up Confirmed"),
            React.createElement(Text, { style: styles.greeting },
              "Your visits have been added"
            ),
            React.createElement(Text, { style: styles.paragraph },
              `Hi ${firstName}, your top-up payment was successful. Your visit balance has been updated.`
            ),
            React.createElement(Section, { style: styles.planBox },
              React.createElement(Text, { style: styles.planTitle }, "TOP-UP SUMMARY"),
              React.createElement(Hr, { style: styles.innerHr }),
              formattedAmount && React.createElement(Row, { style: styles.row },
                React.createElement(Column, { style: styles.keyCol }, "Amount paid"),
                React.createElement(Column, { style: styles.valCol }, formattedAmount)
              ),
              formattedHits && React.createElement(Row, { style: styles.row },
                React.createElement(Column, { style: styles.keyCol }, "Visits added"),
                React.createElement(Column, { style: styles.valCol }, `+${formattedHits}`)
              ),
              formattedBalance && React.createElement(Row, { style: styles.row },
                React.createElement(Column, { style: styles.keyCol }, "New visit balance"),
                React.createElement(Column, { style: styles.valColHighlight }, formattedBalance)
              )
            ),
            React.createElement(Text, { style: styles.note },
              "Your active campaigns will continue running with the updated balance. If any campaigns were paused due to insufficient visits, you can resume them from your dashboard."
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, {
              href: process.env.FRONTEND_URL || "https://trafficboxes.com/dashboard",
              style: styles.button
            }, "Go to Dashboard"),
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
  planBox: { border: "1px solid #e5e7eb", borderRadius: "6px", padding: "20px 24px", marginBottom: "20px" },
  planTitle: { fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.8px", textTransform: "uppercase", margin: "0 0 12px" },
  innerHr: { borderColor: "#f3f4f6", margin: "0 0 8px" },
  row: { width: "100%" },
  keyCol: { fontSize: "14px", color: "#6b7280", paddingTop: "8px", paddingBottom: "8px", width: "55%" },
  valCol: { fontSize: "14px", fontWeight: "600", color: "#111827", paddingTop: "8px", paddingBottom: "8px", textAlign: "right" },
  valColHighlight: { fontSize: "15px", fontWeight: "700", color: "#059669", paddingTop: "8px", paddingBottom: "8px", textAlign: "right" },
  note: { fontSize: "14px", color: "#6b7280", lineHeight: "1.6", margin: "0 0 4px" },
  hr: { borderColor: "#e5e7eb", margin: "28px 0" },
  button: { backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = TopUpEmail;
