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

function WelcomeEmail({ firstName = "there" }) {
  return (
    React.createElement(Html, null,
      React.createElement(Head, null),
      React.createElement(Body, { style: styles.body },
        React.createElement(Container, { style: styles.container },
          React.createElement(Section, { style: styles.header },
            React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
          ),
          React.createElement(Section, { style: styles.content },
            React.createElement(Text, { style: styles.greeting },
              `Welcome, ${firstName}`
            ),
            React.createElement(Text, { style: styles.paragraph },
              "Thank you for creating your TrafficBoxes account. You now have access to our full suite of traffic management and campaign tools."
            ),
            React.createElement(Text, { style: styles.subheading }, "What you can do"),
            React.createElement(Text, { style: styles.listItem }, "Create and manage traffic campaigns"),
            React.createElement(Text, { style: styles.listItem }, "Monitor real-time analytics and performance"),
            React.createElement(Text, { style: styles.listItem }, "Scale your traffic with flexible subscription plans"),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, { href: process.env.FRONTEND_URL || "https://trafficboxes.com/dashboard", style: styles.button },
              "Go to Dashboard"
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "If you have any questions, contact us at connect@trafficboxes.com"
            ),
            React.createElement(Text, { style: styles.footer },
              "TrafficBoxes  |  All rights reserved."
            )
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
  greeting: { fontSize: "22px", fontWeight: "700", color: "#111827", margin: "0 0 16px" },
  paragraph: { fontSize: "15px", color: "#4b5563", lineHeight: "1.6", margin: "0 0 20px" },
  subheading: { fontSize: "13px", fontWeight: "600", color: "#111827", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 10px" },
  listItem: { fontSize: "15px", color: "#4b5563", lineHeight: "1.6", margin: "4px 0", paddingLeft: "12px", borderLeft: "2px solid #e5e7eb" },
  hr: { borderColor: "#e5e7eb", margin: "28px 0" },
  button: { backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = WelcomeEmail;
