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

function ChargebackEmail({
  firstName = "there",
  amount,
  currency = "usd",
  reason,
  disputeId,
}) {
  const formattedAmount = amount ? `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}` : null;

  return (
    React.createElement(Html, null,
      React.createElement(Head, null),
      React.createElement(Body, { style: styles.body },
        React.createElement(Container, { style: styles.container },
          React.createElement(Section, { style: styles.header },
            React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
          ),
          React.createElement(Section, { style: styles.content },
            React.createElement(Text, { style: styles.badge }, "⚠️ Chargeback Dispute Opened"),
            React.createElement(Text, { style: styles.greeting },
              "A chargeback dispute has been opened"
            ),
            React.createElement(Text, { style: styles.paragraph },
              `Hi ${firstName}, a chargeback dispute has been filed against a payment on your account. Here are the details:`
            ),
            React.createElement(Section, { style: styles.infoBox },
              disputeId && React.createElement(Text, { style: styles.infoRow }, `Dispute ID: ${disputeId}`),
              formattedAmount && React.createElement(Text, { style: styles.infoRow }, `Amount: ${formattedAmount}`),
              reason && React.createElement(Text, { style: styles.infoRow }, `Reason: ${reason}`)
            ),
            React.createElement(Text, { style: styles.paragraph },
              "Our team will review and respond to this dispute. If you believe this is an error or want to provide information, please contact us immediately."
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, { href: `mailto:connect@trafficboxes.com?subject=Chargeback Dispute ${disputeId || ""}`, style: styles.button },
              "Contact Support"
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "For urgent matters, email us at connect@trafficboxes.com"
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
  badge: { display: "inline-block", backgroundColor: "#fffbeb", color: "#92400e", fontSize: "13px", fontWeight: "600", padding: "4px 12px", borderRadius: "20px", margin: "0 0 16px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#444", lineHeight: "1.6", margin: "0 0 16px" },
  infoBox: { backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "16px", marginBottom: "16px" },
  infoRow: { fontSize: "14px", color: "#333", margin: "4px 0", lineHeight: "1.5" },
  hr: { borderColor: "#e8ecef", margin: "24px 0" },
  button: { backgroundColor: "#dc2626", color: "#ffffff", fontSize: "15px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "6px", display: "inline-block" },
  footer: { fontSize: "13px", color: "#999", margin: "8px 0", lineHeight: "1.5" },
};

module.exports = ChargebackEmail;
