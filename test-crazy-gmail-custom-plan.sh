#!/bin/bash

# Test Custom Plan Assignment for crazy@gmail.com
# 6 campaigns, 6 million visits

BASE_URL="http://localhost:5001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================"
echo "Custom Plan Test for crazy@gmail.com"
echo "================================================"
echo ""

# Step 1: Admin Login
echo -e "${YELLOW}Step 1: Getting Admin Token...${NC}"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin@trafficbox.com",
    "password": "Test@1234"
  }')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | jq -r '.token')
if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
  echo -e "${GREEN}✓ Admin login successful${NC}"
  echo "Token: ${ADMIN_TOKEN:0:30}..."
else
  echo -e "${RED}✗ Admin login failed${NC}"
  echo "$ADMIN_LOGIN" | jq '.'
  exit 1
fi
echo ""

# Step 2: Find User ID for crazy@gmail.com
echo -e "${YELLOW}Step 2: Finding User ID for crazy@gmail.com...${NC}"
USER_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "crazy@gmail.com",
    "password": "aaaa1234"
  }')

USER_ID=$(echo $USER_LOGIN | jq -r '.user.id')
USER_EMAIL=$(echo $USER_LOGIN | jq -r '.user.email')
USER_NAME=$(echo $USER_LOGIN | jq -r '.user.firstName + " " + .user.lastName')

if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
  echo -e "${GREEN}✓ User found${NC}"
  echo "User ID: $USER_ID"
  echo "Email: $USER_EMAIL"
  echo "Name: $USER_NAME"
else
  echo -e "${RED}✗ User not found or login failed${NC}"
  echo "$USER_LOGIN" | jq '.'
  exit 1
fi
echo ""

# Step 3: Check Current Subscription
echo -e "${YELLOW}Step 3: Checking Current Subscription...${NC}"
CURRENT_SUB=$(curl -s -X GET "$BASE_URL/api/admin/subscriptions/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

CURRENT_PLAN=$(echo $CURRENT_SUB | jq -r '.subscription.planName // "none"')
CURRENT_STATUS=$(echo $CURRENT_SUB | jq -r '.subscription.status // "none"')

echo "Current Plan: $CURRENT_PLAN"
echo "Current Status: $CURRENT_STATUS"
echo ""

# Step 4: Assign Custom Plan with Payment
echo -e "${YELLOW}Step 4: Assigning Custom Plan (6 campaigns, 6M visits)...${NC}"
echo ""
echo -e "${BLUE}Request:${NC}"
echo "POST $BASE_URL/api/admin/subscriptions/users/$USER_ID/custom"
echo '{
  "visitsIncluded": 6000000,
  "campaignLimit": 6,
  "price": 499,
  "description": "Custom plan: 6 campaigns, 6 million visits",
  "reason": "Testing custom plan payment flow for crazy@gmail.com",
  "durationDays": 365
}'
echo ""

CUSTOM_PLAN=$(curl -s -X POST "$BASE_URL/api/admin/subscriptions/users/$USER_ID/custom" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visitsIncluded": 6000000,
    "campaignLimit": 6,
    "price": 499,
    "description": "Custom plan: 6 campaigns, 6 million visits",
    "reason": "Testing custom plan payment flow for crazy@gmail.com",
    "durationDays": 365,
    "features": {
      "countryTargeting": "advanced",
      "trafficSources": "advanced",
      "behaviorSettings": "full-suite",
      "campaignRenewal": "fully-automated",
      "support": "24-7-priority",
      "analytics": "realtime-api"
    }
  }')

echo -e "${BLUE}Response:${NC}"
echo $CUSTOM_PLAN | jq '.'
echo ""

# Extract key information
OK=$(echo $CUSTOM_PLAN | jq -r '.ok')
REQUIRES_PAYMENT=$(echo $CUSTOM_PLAN | jq -r '.requiresPayment')
PAYMENT_LINK=$(echo $CUSTOM_PLAN | jq -r '.paymentLink')
PAYMENT_AMOUNT=$(echo $CUSTOM_PLAN | jq -r '.paymentAmount')
SUB_STATUS=$(echo $CUSTOM_PLAN | jq -r '.subscription.status')
SUB_VISITS=$(echo $CUSTOM_PLAN | jq -r '.subscription.visitsIncluded')
SUB_CAMPAIGNS=$(echo $CUSTOM_PLAN | jq -r '.subscription.campaignLimit')
PAYMENT_ID=$(echo $CUSTOM_PLAN | jq -r '.payment.id')
PAYMENT_STATUS=$(echo $CUSTOM_PLAN | jq -r '.payment.status')

# Step 5: Display Results
echo "================================================"
echo -e "${GREEN}Assignment Results${NC}"
echo "================================================"
echo ""

if [ "$OK" == "true" ]; then
  echo -e "${GREEN}✓ Custom plan assigned successfully!${NC}"
  echo ""
  echo "📋 Subscription Details:"
  echo "  • User: $USER_EMAIL ($USER_NAME)"
  echo "  • Plan: Custom"
  echo "  • Status: $SUB_STATUS"
  echo "  • Campaigns: $SUB_CAMPAIGNS"
  echo "  • Visits: $(printf "%'d" $SUB_VISITS)"
  echo ""
  echo "💳 Payment Details:"
  echo "  • Requires Payment: $REQUIRES_PAYMENT"
  echo "  • Amount: \$$PAYMENT_AMOUNT USD"
  echo "  • Payment ID: $PAYMENT_ID"
  echo "  • Payment Status: $PAYMENT_STATUS"
  echo ""
  
  if [ "$PAYMENT_LINK" != "null" ] && [ -n "$PAYMENT_LINK" ]; then
    echo "================================================"
    echo -e "${YELLOW}🔗 PAYMENT LINK (Copy and open in browser):${NC}"
    echo "================================================"
    echo ""
    echo "$PAYMENT_LINK"
    echo ""
    echo "================================================"
    echo ""
    echo -e "${BLUE}Test Payment Instructions:${NC}"
    echo "1. Copy the payment link above"
    echo "2. Open it in your browser"
    echo "3. Use Stripe test card:"
    echo "   • Card Number: 4242 4242 4242 4242"
    echo "   • Expiry: Any future date (e.g., 12/25)"
    echo "   • CVC: Any 3 digits (e.g., 123)"
    echo "   • ZIP: Any 5 digits (e.g., 12345)"
    echo ""
    echo "4. After payment:"
    echo "   • Check subscription status (should change to 'active')"
    echo "   • Check payment status (should change to 'succeeded')"
    echo "   • Check user notifications for success message"
    echo ""
    
    # Save payment link to file
    echo "$PAYMENT_LINK" > payment-link-crazy-gmail.txt
    echo -e "${GREEN}✓ Payment link saved to: payment-link-crazy-gmail.txt${NC}"
    echo ""
  else
    echo -e "${RED}✗ No payment link created${NC}"
  fi
else
  echo -e "${RED}✗ Assignment failed${NC}"
  echo "$CUSTOM_PLAN" | jq '.'
fi

# Step 6: Check Notifications
echo "================================================"
echo -e "${YELLOW}Checking User Notifications...${NC}"
echo "================================================"
echo ""

USER_TOKEN=$(echo $USER_LOGIN | jq -r '.token')
NOTIFICATIONS=$(curl -s -X GET "$BASE_URL/api/notifications?limit=1" \
  -H "Authorization: Bearer $USER_TOKEN")

LATEST_NOTIF=$(echo $NOTIFICATIONS | jq '.notifications[0]')
NOTIF_TYPE=$(echo $LATEST_NOTIF | jq -r '.type')
NOTIF_TITLE=$(echo $LATEST_NOTIF | jq -r '.title')
NOTIF_ACTION_URL=$(echo $LATEST_NOTIF | jq -r '.actionUrl')
NOTIF_ACTION_LABEL=$(echo $LATEST_NOTIF | jq -r '.actionLabel')

echo "Latest Notification:"
echo $LATEST_NOTIF | jq '{type, title, actionLabel, actionUrl, isRead, createdAt}'
echo ""

if [ "$NOTIF_TYPE" == "custom_plan_assigned_payment_pending" ]; then
  echo -e "${GREEN}✓ Payment notification sent to user${NC}"
  echo "  • Title: $NOTIF_TITLE"
  echo "  • Action: $NOTIF_ACTION_LABEL"
else
  echo -e "${YELLOW}⚠ Latest notification type: $NOTIF_TYPE${NC}"
fi
echo ""

# Step 7: Commands to Check Status After Payment
echo "================================================"
echo -e "${YELLOW}Commands to Check Status After Payment:${NC}"
echo "================================================"
echo ""
echo "1. Check Subscription Status:"
echo "   curl -X GET '$BASE_URL/api/admin/subscriptions/users/$USER_ID' \\"
echo "     -H 'Authorization: Bearer $ADMIN_TOKEN' | jq '.subscription | {planName, status, visitsIncluded, campaignLimit}'"
echo ""
echo "2. Check Payment Status:"
echo "   curl -X GET '$BASE_URL/api/subscription/payments?limit=1' \\"
echo "     -H 'Authorization: Bearer $USER_TOKEN' | jq '.payments[0] | {id, status, amount, description}'"
echo ""
echo "3. Check Notifications:"
echo "   curl -X GET '$BASE_URL/api/notifications?limit=1' \\"
echo "     -H 'Authorization: Bearer $USER_TOKEN' | jq '.notifications[0] | {type, title, isRead}'"
echo ""

echo "================================================"
echo -e "${GREEN}Test Setup Complete!${NC}"
echo "================================================"
echo ""
echo "Next: Open the payment link and complete the test payment."
echo ""
