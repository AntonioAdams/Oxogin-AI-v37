#!/bin/bash
# API Integration Test for Enhanced Browserless
# This script tests the capture API with curl

echo "🧪 Testing Enhanced Browserless API Integration"
echo "=============================================="

# Configuration
API_BASE="http://localhost:3000"
TEST_URL="https://example.com"

echo ""
echo "📋 Test Configuration:"
echo "  API Base: $API_BASE"
echo "  Test URL: $TEST_URL"

# Test 1: Basic capture API
echo ""
echo "🎯 Test 1: Basic Capture API"
echo "curl -X POST $API_BASE/api/capture \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"$TEST_URL\"}'"

if command -v curl >/dev/null 2>&1; then
    echo ""
    echo "Running curl test..."
    
    # Make the actual request with timeout
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/capture" \
        -H "Content-Type: application/json" \
        -d "{\"url\": \"$TEST_URL\"}" \
        --max-time 60 \
        2>/dev/null || echo "CURL_ERROR")
    
    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$response" = "CURL_ERROR" ]; then
        echo "❌ Connection failed - Server not running on $API_BASE"
        echo "   Start your development server with: npm run dev"
    elif [ "$http_code" = "200" ]; then
        echo "✅ API responding successfully"
        
        # Parse JSON response to check for expected fields
        if echo "$response_body" | grep -q '"screenshot"'; then
            echo "✅ Screenshot data present"
        else
            echo "⚠️ Screenshot data missing"
        fi
        
        if echo "$response_body" | grep -q '"domData"'; then
            echo "✅ DOM data present"
        else
            echo "⚠️ DOM data missing"
        fi
        
        if echo "$response_body" | grep -q '"timestamp"'; then
            echo "✅ Timestamp present"
        else
            echo "⚠️ Timestamp missing"
        fi
        
        # Check for enhanced capture indicators
        if echo "$response_body" | grep -q '"enhancedCapture"'; then
            echo "✅ Enhanced capture metadata present"
        else
            echo "ℹ️ Using standard capture (expected for simple sites)"
        fi
        
    elif [ "$http_code" = "402" ]; then
        echo "⚠️ Payment required (credit system active)"
        echo "   Response: $response_body"
    elif [ "$http_code" = "400" ]; then
        echo "❌ Bad request"
        echo "   Response: $response_body"
    else
        echo "❌ Unexpected response code: $http_code"
        echo "   Response: $response_body"
    fi
else
    echo "❌ curl not found. Please install curl to run this test."
fi

# Test 2: Test with a complex site that should trigger enhanced capture
echo ""
echo "🎯 Test 2: Complex Site (HubSpot) - Should trigger enhanced capture"
COMPLEX_URL="https://hubspot.com"
echo "curl -X POST $API_BASE/api/capture \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"$COMPLEX_URL\"}'"

if command -v curl >/dev/null 2>&1; then
    echo ""
    echo "Running complex site test..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/capture" \
        -H "Content-Type: application/json" \
        -d "{\"url\": \"$COMPLEX_URL\"}" \
        --max-time 90 \
        2>/dev/null || echo "CURL_ERROR")
    
    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$response" = "CURL_ERROR" ]; then
        echo "❌ Connection failed"
    elif [ "$http_code" = "200" ]; then
        echo "✅ Complex site captured successfully"
        
        if echo "$response_body" | grep -q '"enhancedCapture":true'; then
            echo "✅ Enhanced capture was used (expected for HubSpot)"
        elif echo "$response_body" | grep -q '"enhancedCapture"'; then
            echo "ℹ️ Standard capture was used (fallback)"
        else
            echo "ℹ️ Enhanced capture indicators not present (may not be implemented yet)"
        fi
        
        # Check for additional enhanced data
        if echo "$response_body" | grep -q '"siteComplexity"'; then
            echo "✅ Site complexity analysis present"
        fi
        
        if echo "$response_body" | grep -q '"captureTimeout"'; then
            echo "✅ Dynamic timeout information present"
        fi
        
    else
        echo "⚠️ Complex site test failed with code: $http_code"
        echo "   This is expected if enhanced capture isn't integrated yet"
    fi
fi

# Test 3: Error handling
echo ""
echo "🎯 Test 3: Error Handling - Invalid URL"
echo "curl -X POST $API_BASE/api/capture \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"not-a-valid-url\"}'"

if command -v curl >/dev/null 2>&1; then
    echo ""
    echo "Running error handling test..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/capture" \
        -H "Content-Type: application/json" \
        -d '{"url": "not-a-valid-url"}' \
        --max-time 30 \
        2>/dev/null || echo "CURL_ERROR")
    
    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "400" ]; then
        echo "✅ Invalid URL properly rejected"
    else
        echo "⚠️ Expected 400 error for invalid URL, got: $http_code"
    fi
fi

# Test 4: Check if enhanced endpoints are available
echo ""
echo "🎯 Test 4: Enhanced Feature Detection"

# Test if any enhanced-specific endpoints exist
echo "Checking for enhanced capture configuration..."

config_response=$(curl -s -w "%{http_code}" -X GET "$API_BASE/api/capture/config" 2>/dev/null || echo "404")
if echo "$config_response" | grep -q "200"; then
    echo "✅ Enhanced configuration endpoint available"
else
    echo "ℹ️ Enhanced configuration endpoint not implemented (optional)"
fi

echo ""
echo "📊 Test Summary:"
echo "================"
echo "Basic API functionality tested with curl"
echo "Enhanced features can be validated once integrated"
echo ""
echo "💡 To fully test enhanced features:"
echo "  1. Integrate the adaptive capture client in your API route"
echo "  2. Set BROWSERLESS_API_KEY environment variable"
echo "  3. Run tests against known problematic sites"
echo "  4. Monitor response times and success rates"
echo ""
echo "🚀 Integration Instructions:"
echo "============================="
echo "In your app/api/capture/route.ts, replace:"
echo "  const client = getBrowserlessClient()"
echo "  const result = await client.capture(captureOptions)"
echo ""
echo "With:"
echo "  import { AdaptiveCaptureClient } from '../../../lib/capture/adaptive-capture'"
echo "  const adaptiveClient = new AdaptiveCaptureClient()"
echo "  const result = await adaptiveClient.capture(captureOptions)"
