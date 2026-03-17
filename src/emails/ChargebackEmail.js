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

function ChargebackEmail({
  firstName = "there",
  amount,
  currency = "usd",
  reason,
  disputeId,
}) {
  const formattedAmount = amount
    ? `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
    : null;

  const rows = [
    disputeId && { label: "Dispute ID", value: disputeId },
    formattedAmount && { label: "Amount", value: formattedAmount },
    reason && { label: "Reason", value: reason },
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
            React.createElement(Text, { style: styles.label }, "Action Required"),
            React.createElement(Text, { style: styles.greeting },
              "A chargeback dispute has been opened"
            ),
            React.createElement(Text, { style: styles.paragraph },
              `Hi ${firstName}, a chargeback dispute has been filed against a recent payment on your account. Please review the details below.`
            ),
            React.createElement(Section, { style: styles.infoBox },
              React.createElement(Text, { style: styles.infoTitle }, "Dispute Details"),
              React.createElement(Hr, { style: styles.innerHr }),
              ...rows.map((row) =>
                React.createElement(Row, { style: styles.row, key: row.label },
                  React.createElement(Column, { style: styles.keyCol }, row.label),
                  React.createElement(Column, { style: styles.valCol }, row.value)
                )
              )
            ),
            React.createElement(Text, { style: styles.paragraph },
              "Our team will review and respond to this dispute. If you have information relevant to this dispute, please contact us immediately."
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, {
              href: `mailto:connect@trafficboxes.com?subject=Chargeback Dispute ${disputeId || ""}`,
              style: styles.button
            }, "Contact Support"),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "For urgent matters, contact us at connect@trafficboxes.com"
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
  label: { display: "inline-block", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.6px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#111827", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#4b5563", lineHeight: "1.6", margin: "0 0 16px" },
  infoBox: { border: "1px solid #fde68a", backgroundColor: "#fffbeb", borderRadius: "6px", padding: "20px 24px", marginBottom: "20px" },
  infoTitle: { fontSize: "12px", fontWeight: "700", color: "#92400e", letterSpacing: "0.8px", textTransform: "uppercase", margin: "0 0 10px" },
  innerHr: { borderColor: "#fde68a", margin: "0 0 8px" },
  row: { width: "100%" },
  keyCol: { fontSize: "14px", color: "#6b7280", paddingTop: "8px", paddingBottom: "8px", width: "45%" },
  valCol: { fontSize: "14px", fontWeight: "600", color: "#111827", paddingTop: "8px", paddingBottom: "8px", textAlign: "right" },
  hr: { borderColor: "#e5e7eb", margin: "28px 0" },
  button: { backgroundColor: "#b91c1c", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = ChargebackEmail;
