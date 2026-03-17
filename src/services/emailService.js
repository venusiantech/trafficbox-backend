const React = require("react");
const { Resend } = require("resend");
const { render } = require("@react-email/render");
const logger = require("../utils/logger");

const WelcomeEmail = require("../emails/WelcomeEmail");
const SubscriptionStartedEmail = require("../emails/SubscriptionStartedEmail");
const SubscriptionCancelledEmail = require("../emails/SubscriptionCancelledEmail");
const ChargebackEmail = require("../emails/ChargebackEmail");
const UpgradeEmail = require("../emails/UpgradeEmail");
const DowngradeEmail = require("../emails/DowngradeEmail");
const CustomPlanEmail = require("../emails/CustomPlanEmail");

let _resend = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = () => process.env.RESEND_FROM_EMAIL || "connect@trafficboxes.com";

async function sendEmail(to, subject, EmailComponent, props) {
  try {
    const html = await render(React.createElement(EmailComponent, props));
    const { data, error } = await getResend().emails.send({ from: FROM(), to, subject, html });
    if (error) {
      logger.error("Email send failed", { to, subject, error });
      return { ok: false, error };
    }
    logger.info("Email sent", { to, subject, id: data?.id });
    return { ok: true, data };
  } catch (err) {
    logger.error("Email service error", { to, subject, error: err.message });
    return { ok: false, error: err.message };
  }
}

async function sendWelcomeEmail(user) {
  return sendEmail(
    user.email,
    "Welcome to TrafficBoxes!",
    WelcomeEmail,
    { firstName: user.firstName || "there" }
  );
}

async function sendSubscriptionStartedEmail(user, subscription) {
  return sendEmail(
    user.email,
    `Your ${subscription.planName} plan is now active`,
    SubscriptionStartedEmail,
    {
      firstName: user.firstName || "there",
      planName: subscription.planName,
      amount: subscription.amount,
      visitsIncluded: subscription.visitsIncluded,
      campaignLimit: subscription.campaignLimit,
      periodEnd: subscription.currentPeriodEnd,
    }
  );
}

async function sendSubscriptionCancelledEmail(user, subscription) {
  return sendEmail(
    user.email,
    "Your TrafficBoxes subscription has been cancelled",
    SubscriptionCancelledEmail,
    {
      firstName: user.firstName || "there",
      planName: subscription.planName,
      canceledAt: subscription.canceledAt || new Date(),
    }
  );
}

async function sendChargebackEmail(user, dispute) {
  return sendEmail(
    user.email,
    "Action Required: Chargeback Dispute Opened",
    ChargebackEmail,
    {
      firstName: user.firstName || "there",
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
      disputeId: dispute.id,
    }
  );
}

async function sendUpgradeEmail(user, subscription) {
  return sendEmail(
    user.email,
    `You've upgraded to the ${subscription.newPlan} plan!`,
    UpgradeEmail,
    {
      firstName: user.firstName || "there",
      oldPlan: subscription.oldPlan,
      newPlan: subscription.newPlan,
      visitsIncluded: subscription.visitsIncluded,
      campaignLimit: subscription.campaignLimit,
      periodEnd: subscription.currentPeriodEnd,
    }
  );
}

async function sendDowngradeEmail(user, subscription) {
  return sendEmail(
    user.email,
    `Your plan has been changed to ${subscription.newPlan}`,
    DowngradeEmail,
    {
      firstName: user.firstName || "there",
      oldPlan: subscription.oldPlan,
      newPlan: subscription.newPlan,
      visitsIncluded: subscription.visitsIncluded,
      campaignLimit: subscription.campaignLimit,
      periodEnd: subscription.currentPeriodEnd,
    }
  );
}

async function sendCustomPlanEmail(user, plan) {
  const subject = plan.paymentLink
    ? "Your Custom Plan is Ready — Complete Payment to Activate"
    : "Your Custom Plan is Now Active!";

  return sendEmail(user.email, subject, CustomPlanEmail, {
    firstName: user.firstName || "there",
    visitsIncluded: plan.visitsIncluded,
    campaignLimit: plan.campaignLimit,
    durationDays: plan.durationDays,
    price: plan.price,
    description: plan.description,
    paymentLink: plan.paymentLink || null,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendSubscriptionStartedEmail,
  sendSubscriptionCancelledEmail,
  sendChargebackEmail,
  sendUpgradeEmail,
  sendDowngradeEmail,
  sendCustomPlanEmail,
};
