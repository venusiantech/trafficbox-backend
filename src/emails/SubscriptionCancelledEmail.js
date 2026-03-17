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

function SubscriptionCancelledEmail({
  firstName = "there",
  planName = "subscription",
  activeUntil,
}) {
  const formattedActiveUntil = activeUntil
    ? new Date(activeUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
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
            React.createElement(Text, { style: styles.label }, "Subscription Cancelled"),
            React.createElement(Text, { style: styles.greeting },
              "Your subscription has been cancelled"
            ),
            React.createElement(Text, { style: styles.paragraph },
              `Hi ${firstName}, we have received your cancellation request for your ${planName ? planName.charAt(0).toUpperCase() + planName.slice(1) : ""} plan.`
            ),

            formattedActiveUntil
              ? React.createElement(Section, { style: styles.infoBox },
                  React.createElement(Text, { style: styles.infoTitle }, "What happens next"),
                  React.createElement(Hr, { style: styles.innerHr }),
                  React.createElement(Text, { style: styles.infoText },
                    "Your subscription has been cancelled but remains fully active until the end of your current billing period."
                  ),
                  React.createElement(Row, { style: styles.highlightRow },
                    React.createElement(Column, { style: styles.highlightKey }, "Access expires on"),
                    React.createElement(Column, { style: styles.highlightVal }, formattedActiveUntil)
                  ),
                  React.createElement(Text, { style: styles.infoText },
                    "After this date, your account will be moved to the free plan. No further charges will be made."
                  )
                )
              : React.createElement(Text, { style: styles.paragraph },
                  "Your account has been moved to the free plan. No further charges will be made."
                ),

            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, {
              href: `${process.env.FRONTEND_URL || "https://trafficboxes.com"}/plans`,
              style: styles.button
            }, "Reactivate Subscription"),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "If you cancelled by mistake, you can reactivate your plan at any time before the expiry date."
            ),
            React.createElement(Text, { style: styles.footer },
              "Questions? Contact us at connect@trafficboxes.com"
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
  label: { display: "inline-block", backgroundColor: "#fee2e2", color: "#991b1b", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.6px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#111827", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#4b5563", lineHeight: "1.6", margin: "0 0 20px" },
  infoBox: { border: "1px solid #e5e7eb", borderRadius: "6px", padding: "20px 24px", marginBottom: "4px" },
  infoTitle: { fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.8px", textTransform: "uppercase", margin: "0 0 10px" },
  innerHr: { borderColor: "#f3f4f6", margin: "0 0 12px" },
  infoText: { fontSize: "14px", color: "#4b5563", lineHeight: "1.6", margin: "0 0 12px" },
  highlightRow: { backgroundColor: "#f9fafb", borderRadius: "5px", width: "100%" },
  highlightKey: { fontSize: "14px", color: "#6b7280", padding: "10px 14px", width: "55%" },
  highlightVal: { fontSize: "14px", fontWeight: "700", color: "#111827", padding: "10px 14px", textAlign: "right" },
  hr: { borderColor: "#e5e7eb", margin: "28px 0" },
  button: { backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = SubscriptionCancelledEmail;
