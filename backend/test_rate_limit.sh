#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InJhdGV0ZXN0QGdtYWlsLmNvbSIsImlhdCI6MTc2NTQ4MzAzNCwiZXhwIjoxNzY1NTY5NDM0LCJuYW1lIjoiUmF0ZSBUZXN0IFVzZXIiLCJmaXRuZXNzX2xldmVsIjoiIn0.7uil9_83Q75tgxYAhaKqT4bRNqvqmn8EMaOljkhokzA"
API_URL="http://172.210.115.60:8000"

echo "Testing rate limiting on /api/generate-weekly-plan (limit: 5 per hour)"
echo "================================================================"

for i in {1..6}; do
  echo -n "Request $i: "
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL/api/generate-weekly-plan" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "goals": ["Weight Loss"],
      "available_days": 3,
      "preferred_duration": 30,
      "experience": "beginner",
      "equipment": ["bodyweight"]
    }')
  
  HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")
  
  if [ "$HTTP_CODE" = "429" ]; then
    echo "✅ RATE LIMITED (HTTP $HTTP_CODE)"
  elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅ SUCCESS (HTTP $HTTP_CODE)"
  else
    echo "❌ ERROR (HTTP $HTTP_CODE): $BODY" | head -c 100
  fi
  
  sleep 1
done

echo ""
echo "Testing food identification rate limit (limit: 20 per hour)"
echo "================================================================"

# Create a simple test image in base64
TEST_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

for i in {1..3}; do
  echo -n "Request $i: "
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL/api/identify_food" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"image\": \"$TEST_IMAGE\"}")
  
  HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "429" ]; then
    echo "✅ HTTP $HTTP_CODE"
  else
    echo "❌ ERROR (HTTP $HTTP_CODE)"
  fi
  
  sleep 1
done
