#!/bin/bash
# Check if checkeasy.co is verified in Resend
DOMAIN_ID="999165c0-aa07-4164-bc22-3e9492a7cdc2"
API_KEY="re_D5VpdJkS_4BdpJ9ZjA5EUcGUCXZhpk8rg"

# Trigger verification
curl -s -X POST "https://api.resend.com/domains/${DOMAIN_ID}/verify" \
  -H "Authorization: Bearer ${API_KEY}" > /dev/null

sleep 5

# Check status
STATUS=$(curl -s "https://api.resend.com/domains/${DOMAIN_ID}" \
  -H "Authorization: Bearer ${API_KEY}" | jq -r '.status')

echo "[$(date)] checkeasy.co domain status: ${STATUS}"

if [ "$STATUS" = "verified" ]; then
  echo "DOMAIN VERIFIED! Ready to send from adrien@checkeasy.co"
fi
