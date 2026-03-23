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

function LeadCaptureEmail({ websiteUrl, activationToken }) {
  const displayUrl = websiteUrl
    ? websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null;
  const activateUrl = `https://trafficboxes.com/activate${activationToken ? `?token=${activationToken}` : ""}`;

  return (
    React.createElement(Html, null,
      React.createElement(Head, null),
      React.createElement(Body, { style: styles.body },
        React.createElement(Container, { style: styles.container },
          React.createElement(Section, { style: styles.header },
            React.createElement(Text, { style: styles.logo }, "TrafficBoxes")
          ),
          React.createElement(Section, { style: styles.content },
            React.createElement(Text, { style: styles.label }, "Your Free Traffic is Reserved"),
            React.createElement(Text, { style: styles.greeting },
              "2,000 free visits are waiting for you"
            ),
            React.createElement(Text, { style: styles.paragraph },
              "We have reserved your free traffic allocation. Here is what is ready for your website:"
            ),

            React.createElement(Section, { style: styles.planBox },
              React.createElement(Text, { style: styles.planTitle }, "FREE PLAN — RESERVED"),
              React.createElement(Hr, { style: styles.innerHr }),
              React.createElement(Row, { style: styles.row },
                React.createElement(Column, { style: styles.keyCol }, "Free visits"),
                React.createElement(Column, { style: styles.valCol }, "2,000")
              ),
              React.createElement(Row, { style: styles.row },
                React.createElement(Column, { style: styles.keyCol }, "Active campaigns"),
                React.createElement(Column, { style: styles.valCol }, "1")
              ),
              displayUrl && React.createElement(Row, { style: styles.row },
                React.createElement(Column, { style: styles.keyCol }, "Your website"),
                React.createElement(Column, { style: styles.valCol }, displayUrl)
              )
            ),

            React.createElement(Section, { style: styles.noticeBox },
              React.createElement(Text, { style: styles.noticeText },
                "To activate your free traffic, you need to create your TrafficBoxes account. Your website has already been saved — simply sign up and your campaign will be ready to launch."
              )
            ),

            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Button, {
              href: activateUrl,
              style: styles.button
            }, "Activate Your Account"),
            React.createElement(Hr, { style: styles.hr }),
            React.createElement(Text, { style: styles.footer },
              "This offer was triggered by a visit to TrafficBoxes. If you did not request this, you can ignore this email."
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
  label: { display: "inline-block", backgroundColor: "#dcfce7", color: "#166534", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.6px" },
  greeting: { fontSize: "22px", fontWeight: "700", color: "#111827", margin: "0 0 12px" },
  paragraph: { fontSize: "15px", color: "#4b5563", lineHeight: "1.6", margin: "0 0 24px" },
  planBox: { border: "1px solid #e5e7eb", borderRadius: "6px", padding: "20px 24px", marginBottom: "16px" },
  planTitle: { fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.8px", textTransform: "uppercase", margin: "0 0 12px" },
  innerHr: { borderColor: "#f3f4f6", margin: "0 0 8px" },
  row: { width: "100%" },
  keyCol: { fontSize: "14px", color: "#6b7280", paddingTop: "8px", paddingBottom: "8px", width: "55%" },
  valCol: { fontSize: "14px", fontWeight: "600", color: "#111827", paddingTop: "8px", paddingBottom: "8px", textAlign: "right" },
  noticeBox: { backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "16px 20px", marginBottom: "4px" },
  noticeText: { fontSize: "14px", color: "#4b5563", lineHeight: "1.6", margin: "0" },
  hr: { borderColor: "#e5e7eb", margin: "28px 0" },
  button: { backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: "600", textDecoration: "none", padding: "12px 28px", borderRadius: "5px", display: "inline-block", letterSpacing: "0.3px" },
  footer: { fontSize: "12px", color: "#9ca3af", margin: "6px 0", lineHeight: "1.5" },
};

module.exports = LeadCaptureEmail;
