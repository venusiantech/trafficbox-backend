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

function SubscriptionCancelledEmail({
  firstName = "there",
  planName = "subscription",
  canceledAt,
}) {
  const formattedDate = canceledAt
    ? new Date(canceledAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    React.createElement(Html, null,
      React.createElement(Head, null),
      React.createElement(Body, { style: styles.body },
        React.createElement(Container, { style: styles.container },
          React.createElement(Section, { style: styles.header },
            React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
          ),
          React.createElement(Section, { style: styles.content },
            React.createElement(Text, { style: styles.badge }, "Subscription Cancelled"),
            React.createElement(Text, { style: styles.greeting },
              `Your ${planName} plan has been cancelled`
            ),
            React.createElement(Text, { style: styles.paragraph },
              `Hi ${firstName}, we're sorry to see you go. Your ${planName} subscription was cancelled on ${formattedDate}.`
            ),
            React.createElement(Text, { style: styles.paragraph },
              "Your account has been moved to the free plan. You can resubscribe any time to regain access to all features."
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, { href: `${process.env.FRONTEND_URL || "https://trafficboxes.com"}/plans`, style: styles.button },
              "View Plans"
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "If you cancelled by mistake or have questions, contact us at connect@trafficboxes.com"
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
  badge: { display: "inline-block", backgroundColor: "#fef2f2", color: "#991b1b", fontSize: "13px", fontWeight: "600", padding: "4px 12px", borderRadius: "20px", margin: "0 0 16px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#444", lineHeight: "1.6", margin: "0 0 12px" },
  hr: { borderColor: "#e8ecef", margin: "24px 0" },
  button: { backgroundColor: "#4f46e5", color: "#ffffff", fontSize: "15px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "6px", display: "inline-block" },
  footer: { fontSize: "13px", color: "#999", margin: "8px 0", lineHeight: "1.5" },
};

module.exports = SubscriptionCancelledEmail;
