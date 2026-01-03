/**
 * Script to create Stripe products and prices
 * Run this once to set up your subscription plans in Stripe
 *
 * Usage: node scripts/create-stripe-products.js
 */

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const plans = [
  {
    name: "Starter Plan",
    description:
      "Great for individuals and small businesses - 2 campaigns, 50K visits/month",
    price: 4900, // $49.00 in cents
    campaignLimit: 2,
    visits: 50000,
    envVar: "STRIPE_PRICE_STARTER",
  },
  {
    name: "Growth Plan",
    description:
      "Ideal for growing businesses - 3 campaigns, 250K visits/month",
    price: 19900, // $199.00 in cents
    campaignLimit: 3,
    visits: 250000,
    envVar: "STRIPE_PRICE_GROWTH",
  },
  {
    name: "Business Plan",
    description: "For established businesses - 5 campaigns, 500K visits/month",
    price: 34900, // $349.00 in cents
    campaignLimit: 5,
    visits: 500000,
    envVar: "STRIPE_PRICE_BUSINESS",
  },
  {
    name: "Premium Plan",
    description: "Enterprise solution - 10 campaigns, 1M visits/month",
    price: 59900, // $599.00 in cents
    campaignLimit: 10,
    visits: 1000000,
    envVar: "STRIPE_PRICE_PREMIUM",
  },
];

async function createProducts() {
  console.log("🚀 Creating Stripe products and prices...\n");
  console.log("📌 Note: This will create products in your Stripe account\n");

  const results = [];

  for (const plan of plans) {
    try {
      console.log(`Creating: ${plan.name}...`);

      // Create product
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: {
          campaignLimit: plan.campaignLimit.toString(),
          visitsIncluded: plan.visits.toString(),
        },
      });

      console.log(`  ✓ Product created: ${product.id}`);

      // Create price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price,
        currency: "usd",
        recurring: {
          interval: "month",
        },
        metadata: {
          planName: plan.name.toLowerCase().split(" ")[0], // 'starter', 'growth', etc.
          campaignLimit: plan.campaignLimit.toString(),
          visitsIncluded: plan.visits.toString(),
        },
      });

      console.log(`  ✓ Price created: ${price.id}\n`);

      results.push({
        planName: plan.name,
        productId: product.id,
        priceId: price.id,
        envVar: plan.envVar,
        amount: `$${(plan.price / 100).toFixed(2)}`,
      });
    } catch (error) {
      console.error(`  ✗ Error creating ${plan.name}:`, error.message);
    }
  }

  // Display results
  console.log("\n" + "=".repeat(70));
  console.log("✅ PRODUCTS CREATED SUCCESSFULLY!");
  console.log("=".repeat(70) + "\n");

  console.log("📋 Add these to your .env file:\n");

  results.forEach((result) => {
    console.log(`${result.envVar}=${result.priceId}`);
  });

  console.log("\n" + "=".repeat(70));
  console.log("📊 SUMMARY:");
  console.log("=".repeat(70) + "\n");

  results.forEach((result) => {
    console.log(`${result.planName}:`);
    console.log(`  Product ID: ${result.productId}`);
    console.log(`  Price ID:   ${result.priceId}`);
    console.log(`  Amount:     ${result.amount}/month\n`);
  });

  console.log(
    "🎉 Setup complete! Update your .env file and restart the server.\n"
  );
}

// Run the script
createProducts().catch((error) => {
  console.error("❌ Script failed:", error.message);
  process.exit(1);
});
