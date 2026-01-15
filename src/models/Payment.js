const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    
    // Stripe identifiers
    stripePaymentIntentId: {
      type: String,
      index: true,
    },
    stripeInvoiceId: {
      type: String,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      index: true,
    },

    // Payment details
    amount: {
      type: Number,
      required: true, // Amount in cents
    },
    currency: {
      type: String,
      default: "usd",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "canceled", "refunded", "disputed", "requires_action"],
      required: true,
    },
    
    // Payment type
    type: {
      type: String,
      enum: ["subscription", "one_time", "upgrade", "downgrade", "cancellation", "reactivation"],
      required: true,
    },
    
    // Plan information
    planName: {
      type: String,
      enum: ["free", "starter", "growth", "business", "premium", "custom"],
      required: true,
    },
    
    // Billing period (for subscription payments)
    periodStart: {
      type: Date,
    },
    periodEnd: {
      type: Date,
    },
    
    // Payment method
    paymentMethod: {
      type: String,
      default: "card",
    },
    
    // Receipt and invoice URLs
    receiptUrl: {
      type: String,
    },
    invoiceUrl: {
      type: String,
    },
    
    // Description
    description: {
      type: String,
    },
    
    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    
    // Processing dates
    processedAt: {
      type: Date,
      default: Date.now,
    },
    failedAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    
    // Failure reason
    failureReason: {
      type: String,
    },
  },
  { 
    timestamps: true,
    // Add indexes for common queries
    indexes: [
      { user: 1, status: 1 },
      { user: 1, createdAt: -1 },
      { stripeCustomerId: 1 },
      { stripeInvoiceId: 1 },
      { stripePaymentIntentId: 1 },
    ]
  }
);

// Index for efficient queries
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ stripeCustomerId: 1 });

// Static method to create payment record from Stripe data
paymentSchema.statics.createFromStripeInvoice = async function(invoice, userId, subscriptionId) {
  // Get subscription to determine plan name
  const Subscription = require("./Subscription");
  const subscription = await Subscription.findById(subscriptionId);
  const planName = subscription ? subscription.planName : 'starter';
  
  const payment = new this({
    user: userId,
    subscription: subscriptionId,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: invoice.customer,
    stripeSubscriptionId: invoice.subscription,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status === 'paid' ? 'succeeded' : 'failed',
    type: 'subscription',
    planName: planName,
    periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
    periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    receiptUrl: invoice.hosted_invoice_url,
    invoiceUrl: invoice.hosted_invoice_url,
    description: `Subscription payment - ${invoice.lines?.data[0]?.description || planName + ' plan'}`,
    processedAt: new Date(invoice.created * 1000),
  });
  
  return payment.save();
};

// Static method to create subscription lifecycle event record
paymentSchema.statics.createLifecycleEvent = async function(eventType, subscription, userId, metadata = {}) {
  const eventDescriptions = {
    'created': 'Subscription created',
    'canceled': 'Subscription canceled',
    'reactivated': 'Subscription reactivated',
    'upgraded': 'Subscription upgraded',
    'downgraded': 'Subscription downgraded',
  };

  const payment = new this({
    user: userId,
    subscription: subscription._id,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    amount: eventType === 'canceled' ? 0 : (subscription.planConfig?.price || 0) * 100,
    currency: 'usd',
    status: 'succeeded',
    type: eventType === 'canceled' ? 'cancellation' : 
          eventType === 'reactivated' ? 'reactivation' : 'subscription',
    planName: subscription.planName,
    description: `${eventDescriptions[eventType] || 'Subscription event'} - ${subscription.planName} plan`,
    processedAt: new Date(),
    metadata: {
      lifecycleEvent: eventType,
      ...metadata,
    },
  });
  
  return payment.save();
};

// Method to get formatted amount
paymentSchema.methods.getFormattedAmount = function() {
  return (this.amount / 100).toFixed(2);
};

// Method to check if this is a lifecycle event
paymentSchema.methods.isLifecycleEvent = function() {
  return this.metadata && this.metadata.lifecycleEvent;
};

module.exports = mongoose.model("Payment", paymentSchema);
