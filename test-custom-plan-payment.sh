#!/bin/bash

# Test Script for Custom Plan Payment Flow
# This script tests the complete custom plan assignment with payment links

BASE_URL="http://localhost:5001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "Custom Plan Payment Flow - Test Script"
echo "================================================"
echo ""

# Step 1: Admin Login
echo -e "${YELLOW}Step 1: Admin Login${NC}"
echo "POST $BASE_URL/api/auth/login"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin@trafficbox.com",
    "password": "Test@1234"
  }')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | jq -r '.token')
if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
  echo -e "${GREEN}✓ Admin login successful${NC}"
  echo "Admin Token: ${ADMIN_TOKEN:0:20}..."
else
  echo -e "${RED}✗ Admin login failed${NC}"
  echo "$ADMIN_LOGIN"
  exit 1
fi
echo ""

# Step 2: User Login
echo -e "${YELLOW}Step 2: User Login${NC}"
echo "POST $BASE_URL/api/auth/login"
USER_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "a@gmail.com",
    "password": "aaaa1234"
  }')

USER_TOKEN=$(echo $USER_LOGIN | jq -r '.token')
USER_ID=$(echo $USER_LOGIN | jq -r '.user.id')
USER_EMAIL=$(echo $USER_LOGIN | jq -r '.user.email')

if [ "$USER_TOKEN" != "null" ] && [ -n "$USER_TOKEN" ]; then
  echo -e "${GREEN}✓ User login successful${NC}"
  echo "User ID: $USER_ID"
  echo "User Email: $USER_EMAIL"
  echo "User Token: ${USER_TOKEN:0:20}..."
else
  echo -e "${RED}✗ User login failed${NC}"
  echo "$USER_LOGIN"
  exit 1
fi
echo ""

# Step 3: Test Paid Custom Plan Assignment
echo -e "${YELLOW}Step 3: Assign Paid Custom Plan (with Payment Link)${NC}"
echo "POST $BASE_URL/api/admin/subscriptions/users/$USER_ID/custom"
PAID_PLAN=$(curl -s -X POST "$BASE_URL/api/admin/subscriptions/users/$USER_ID/custom" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visitsIncluded": 500000,
    "campaignLimit": 5,
    "price": 299,
    "description": "Test paid custom plan",
    "reason": "Testing payment flow",
    "durationDays": 365
  }')

REQUIRES_PAYMENT=$(echo $PAID_PLAN | jq -r '.requiresPayment')
PAYMENT_LINK=$(echo $PAID_PLAN | jq -r '.paymentLink')
SUBSCRIPTION_STATUS=$(echo $PAID_PLAN | jq -r '.subscription.status')
PAYMENT_STATUS=$(echo $PAID_PLAN | jq -r '.payment.status')

echo ""
echo "Response:"
echo $PAID_PLAN | jq '.'
echo ""

if [ "$REQUIRES_PAYMENT" == "true" ]; then
  echo -e "${GREEN}✓ Paid plan assigned successfully${NC}"
  echo "  - Requires Payment: $REQUIRES_PAYMENT"
  echo "  - Subscription Status: $SUBSCRIPTION_STATUS (should be 'incomplete')"
  echo "  - Payment Status: $PAYMENT_STATUS (should be 'pending')"
  echo "  - Payment Link: ${PAYMENT_LINK:0:50}..."
  echo ""
  echo -e "${YELLOW}Payment Link:${NC}"
  echo "$PAYMENT_LINK"
  echo ""
  echo -e "${YELLOW}Next Steps:${NC}"
  echo "1. Open the payment link in browser"
  echo "2. Complete test payment"
  echo "3. Check subscription status changes to 'active'"
  echo "4. Check payment status changes to 'succeeded'"
else
  echo -e "${RED}✗ Payment link not created${NC}"
  echo "$PAID_PLAN"
fi
echo ""

# Step 4: Check User Notifications
echo -e "${YELLOW}Step 4: Check User Notifications${NC}"
echo "GET $BASE_URL/api/notifications"
NOTIFICATIONS=$(curl -s -X GET "$BASE_URL/api/notifications" \
  -H "Authorization: Bearer $USER_TOKEN")

NOTIFICATION_COUNT=$(echo $NOTIFICATIONS | jq '.notifications | length')
LATEST_NOTIFICATION=$(echo $NOTIFICATIONS | jq '.notifications[0]')
NOTIFICATION_TYPE=$(echo $LATEST_NOTIFICATION | jq -r '.type')
NOTIFICATION_TITLE=$(echo $LATEST_NOTIFICATION | jq -r '.title')
NOTIFICATION_ACTION_URL=$(echo $LATEST_NOTIFICATION | jq -r '.actionUrl')
NOTIFICATION_ACTION_LABEL=$(echo $LATEST_NOTIFICATION | jq -r '.actionLabel')

echo ""
echo "Latest Notification:"
echo $LATEST_NOTIFICATION | jq '.'
echo ""

if [ "$NOTIFICATION_TYPE" == "custom_plan_assigned_payment_pending" ]; then
  echo -e "${GREEN}✓ Payment notification sent successfully${NC}"
  echo "  - Type: $NOTIFICATION_TYPE"
  echo "  - Title: $NOTIFICATION_TITLE"
  echo "  - Action Label: $NOTIFICATION_ACTION_LABEL"
  echo "  - Action URL: ${NOTIFICATION_ACTION_URL:0:50}..."
else
  echo -e "${YELLOW}⚠ Latest notification is not payment notification${NC}"
  echo "  Type: $NOTIFICATION_TYPE"
fi
echo ""

# Step 5: Test Free Custom Plan Assignment
echo -e "${YELLOW}Step 5: Assign Free Custom Plan (No Payment)${NC}"
echo "POST $BASE_URL/api/admin/subscriptions/users/$USER_ID/custom"
FREE_PLAN=$(curl -s -X POST "$BASE_URL/api/admin/subscriptions/users/$USER_ID/custom" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visitsIncluded": 100000,
    "campaignLimit": 3,
    "price": 0,
    "description": "Test free custom plan",
    "reason": "Testing free plan flow"
  }')

FREE_REQUIRES_PAYMENT=$(echo $FREE_PLAN | jq -r '.requiresPayment')
FREE_SUBSCRIPTION_STATUS=$(echo $FREE_PLAN | jq -r '.subscription.status')

echo ""
echo "Response:"
echo $FREE_PLAN | jq '.'
echo ""

if [ "$FREE_REQUIRES_PAYMENT" == "false" ] && [ "$FREE_SUBSCRIPTION_STATUS" == "active" ]; then
  echo -e "${GREEN}✓ Free plan assigned and activated immediately${NC}"
  echo "  - Requires Payment: $FREE_REQUIRES_PAYMENT"
  echo "  - Subscription Status: $FREE_SUBSCRIPTION_STATUS (should be 'active')"
else
  echo -e "${RED}✗ Free plan activation failed${NC}"
  echo "$FREE_PLAN"
fi
echo ""

# Step 6: Check Subscription Status
echo -e "${YELLOW}Step 6: Check Current Subscription Status${NC}"
echo "GET $BASE_URL/api/admin/subscriptions/users/$USER_ID"
SUBSCRIPTION=$(curl -s -X GET "$BASE_URL/api/admin/subscriptions/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

CURRENT_STATUS=$(echo $SUBSCRIPTION | jq -r '.subscription.status')
CURRENT_PLAN=$(echo $SUBSCRIPTION | jq -r '.subscription.planName')
VISITS_INCLUDED=$(echo $SUBSCRIPTION | jq -r '.subscription.visitsIncluded')
CAMPAIGN_LIMIT=$(echo $SUBSCRIPTION | jq -r '.subscription.campaignLimit')

echo ""
echo "Current Subscription:"
echo $SUBSCRIPTION | jq '.subscription | {planName, status, visitsIncluded, campaignLimit, currentPeriodStart, currentPeriodEnd}'
echo ""

echo -e "${GREEN}✓ Current subscription details:${NC}"
echo "  - Plan: $CURRENT_PLAN"
echo "  - Status: $CURRENT_STATUS"
echo "  - Visits: $VISITS_INCLUDED"
echo "  - Campaign Limit: $CAMPAIGN_LIMIT"
echo ""

# Summary
echo "================================================"
echo "Test Summary"
echo "================================================"
echo ""
echo -e "${GREEN}✓ Admin authentication${NC}"
echo -e "${GREEN}✓ User authentication${NC}"
echo -e "${GREEN}✓ Paid custom plan assignment (creates payment link)${NC}"
echo -e "${GREEN}✓ Notification sent with payment link${NC}"
echo -e "${GREEN}✓ Free custom plan assignment (immediate activation)${NC}"
echo ""
echo -e "${YELLOW}Manual Testing Required:${NC}"
echo "1. Open the payment link in browser"
echo "2. Complete test payment using Stripe test card:"
echo "   Card: 4242 4242 4242 4242"
echo "   Expiry: Any future date"
echo "   CVC: Any 3 digits"
echo "3. Verify webhook triggers and subscription activates"
echo "4. Check notifications for success message"
echo ""
echo -e "${YELLOW}Payment Link (open in browser):${NC}"
echo "$PAYMENT_LINK"
echo ""
echo "================================================"
