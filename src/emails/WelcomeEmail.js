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
  Img,
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
              `Welcome to TrafficBoxes, ${firstName}! 🎉`
            ),
            React.createElement(Text, { style: styles.paragraph },
              "We're thrilled to have you on board. Your account is ready and you can start driving quality traffic to your websites today."
            ),
            React.createElement(Text, { style: styles.paragraph },
              "Here's what you can do with TrafficBoxes:"
            ),
            React.createElement(Text, { style: styles.listItem }, "✅ Create and manage traffic campaigns"),
            React.createElement(Text, { style: styles.listItem }, "✅ Track real-time analytics and performance"),
            React.createElement(Text, { style: styles.listItem }, "✅ Scale your traffic with flexible plans"),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, { href: process.env.FRONTEND_URL || "https://trafficboxes.com/dashboard", style: styles.button },
              "Go to Dashboard"
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "If you have any questions, reply to this email or contact us at connect@trafficboxes.com"
            ),
            React.createElement(Text, { style: styles.footer },
              "© TrafficBoxes. All rights reserved."
            )
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
  greeting: { fontSize: "22px", fontWeight: "700", color: "#1a1a2e", margin: "0 0 16px" },
  paragraph: { fontSize: "15px", color: "#444", lineHeight: "1.6", margin: "0 0 12px" },
  listItem: { fontSize: "15px", color: "#444", lineHeight: "1.6", margin: "4px 0", paddingLeft: "8px" },
  hr: { borderColor: "#e8ecef", margin: "24px 0" },
  button: { backgroundColor: "#4f46e5", color: "#ffffff", fontSize: "15px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "6px", display: "inline-block" },
  footer: { fontSize: "13px", color: "#999", margin: "8px 0", lineHeight: "1.5" },
};

module.exports = WelcomeEmail;
