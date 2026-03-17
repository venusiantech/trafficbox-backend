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
  const formattedPrice = price != null ? `$${Number(price).toFixed(2)}` : null;

  return (
    React.createElement(Html, null,
      React.createElement(Head, null),
      React.createElement(Body, { style: styles.body },
        React.createElement(Container, { style: styles.container },
          React.createElement(Section, { style: styles.header },
            React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
          ),
          React.createElement(Section, { style: styles.content },
            React.createElement(Text, { style: styles.badge },
              requiresPayment ? "🎉 Custom Plan Assigned — Payment Required" : "🎉 Custom Plan Activated"
            ),
            React.createElement(Text, { style: styles.greeting },
              requiresPayment
                ? "A custom plan has been prepared for you!"
                : "Your custom plan is now active!"
            ),
            React.createElement(Text, { style: styles.paragraph },
              requiresPayment
                ? `Hi ${firstName}, our team has put together a custom plan just for you. Complete your payment to activate it.`
                : `Hi ${firstName}, your custom plan has been activated by our team. You can start using it right away!`
            ),
            React.createElement(Section, { style: styles.planBox },
              React.createElement(Text, { style: styles.planTitle }, "CUSTOM PLAN DETAILS"),
              visitsIncluded && React.createElement(Text, { style: styles.planDetail }, `🚀 ${Number(visitsIncluded).toLocaleString()} visits / month`),
              campaignLimit && React.createElement(Text, { style: styles.planDetail }, `📁 Up to ${campaignLimit} campaigns`),
              React.createElement(Text, { style: styles.planDetail }, `📅 Valid for ${durationDays} days`),
              formattedPrice && React.createElement(Text, { style: styles.planDetail }, `💳 ${formattedPrice}`),
              description && React.createElement(Text, { style: styles.planDetail }, `📝 ${description}`)
            ),
            requiresPayment && React.createElement(React.Fragment, null,
              React.createElement(Text, { style: styles.paymentNote },
                "Click the button below to complete your payment and activate your custom plan."
              ),
              React.createElement(Hr, { style: styles.hr }),
              React.createElement(Button, { href: paymentLink, style: styles.payButton },
                `Pay ${formattedPrice || "Now"} & Activate Plan`
              )
            ),
            !requiresPayment && React.createElement(React.Fragment, null,
              React.createElement(Hr, { style: styles.hr }),
              React.createElement(Button, { href: process.env.FRONTEND_URL || "https://trafficboxes.com/dashboard", style: styles.button },
                "Go to Dashboard"
              )
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "Questions about your plan? Contact us at connect@trafficboxes.com"
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
  badge: { display: "inline-block", backgroundColor: "#ecfdf5", color: "#065f46", fontSize: "13px", fontWeight: "600", padding: "4px 12px", borderRadius: "20px", margin: "0 0 16px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#444", lineHeight: "1.6", margin: "0 0 20px" },
  planBox: { backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "20px", marginBottom: "20px" },
  planTitle: { fontSize: "12px", fontWeight: "700", color: "#15803d", letterSpacing: "1px", margin: "0 0 12px" },
  planDetail: { fontSize: "15px", color: "#333", margin: "6px 0", lineHeight: "1.5" },
  paymentNote: { fontSize: "15px", color: "#444", lineHeight: "1.6", margin: "0 0 8px", fontWeight: "500" },
  hr: { borderColor: "#e8ecef", margin: "24px 0" },
  button: { backgroundColor: "#4f46e5", color: "#ffffff", fontSize: "15px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "6px", display: "inline-block" },
  payButton: { backgroundColor: "#059669", color: "#ffffff", fontSize: "15px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "6px", display: "inline-block" },
  footer: { fontSize: "13px", color: "#999", margin: "8px 0", lineHeight: "1.5" },
};

module.exports = CustomPlanEmail;
