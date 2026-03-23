const React = require("react");
const {
  Html, Head, Body, Container, Section, Text, Hr,
} = require("@react-email/components");

function ContactAckEmail({ firstName = "there", message = "" }) {
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
              `Hi ${firstName},`
            ),
            React.createElement(Text, { style: styles.paragraph },
              "Thank you for reaching out. We have received your message and our team will get back to you within 1–2 business days."
            ),
            React.createElement(Text, { style: styles.subheading }, "Your message"),
            React.createElement(Text, { style: styles.messageBox }, message),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.paragraph },
              "In the meantime, if you have any urgent questions, feel free to reply to this email."
            ),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "This is an automated acknowledgement. Please do not reply directly to this email."
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
  messageBox: { fontSize: "14px", color: "#4b5563", lineHeight: "1.6", backgroundColor: "#f9fafb", padding: "16px", borderRadius: "5px", borderLeft: "3px solid #d1d5db", margin: "0 0 20px", fontStyle: "italic" },
  hr: { borderColor: "#e5e7eb", margin: "28px 0" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = ContactAckEmail;
