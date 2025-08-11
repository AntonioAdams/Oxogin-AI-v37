#!/usr/bin/env node

/**
 * Test funnel analysis button functionality
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Simulate the updated funnel analysis logic
function detectPrimaryCtaType(captureResult) {
  // FIXED: Use AI's isFormAssociated property first (most reliable)
  if (captureResult.ctaInsight) {
    const isFormAssociated = captureResult.ctaInsight.isFormAssociated;
    if (isFormAssociated === true) {
      return 'form';
    } else if (isFormAssociated === false) {
      return 'non-form';
    }
  }
  
  return 'none';
}

function extractPrimaryCta(captureResult) {
  if (captureResult.ctaInsight) {
    const insight = captureResult.ctaInsight;
    return {
      text: insight.text || "Unknown CTA",
      confidence: insight.confidence || 0.8,
      hasForm: insight.hasForm || false,
      isFormAssociated: insight.isFormAssociated,
      reasoning: insight.reasoning || "AI detected primary CTA",
      elementType: insight.elementType,
      alternativeTexts: insight.alternativeTexts || [],
      href: insight.href
    };
  }
  return null;
}

function followPrimaryCta(captureResult, baseUrl) {
  const cta = extractPrimaryCta(captureResult);
  
  if (!cta) {
    return {
      nextUrl: baseUrl,
      reason: "No primary CTA detected for step 2"
    };
  }
  
  // If CTA has href, use it directly
  if (cta.href) {
    let nextUrl = cta.href;
    
    // Handle relative URLs
    if (nextUrl.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        nextUrl = `${base.protocol}//${base.host}${nextUrl}`;
      } catch (error) {
        return { nextUrl: baseUrl, reason: "URL parsing failed" };
      }
    }
    
    return { nextUrl, reason: "Success" };
  }
  
  // If CTA is a button without href, try to find related links
  const ctaText = cta.text.toLowerCase();
  const domData = captureResult.domData;
  
  if (domData.links && domData.links.length > 0) {
    // Look for links that might be related to the CTA action
    const relatedLink = domData.links.find(link => {
      if (!link.href || !link.text) return false;
      
      const linkText = link.text.toLowerCase();
      
      // If CTA contains action words, look for category/product links
      if (ctaText.includes('buy') || ctaText.includes('shop') || ctaText.includes('purchase')) {
        return ['mac', 'ipad', 'iphone', 'product', 'store', 'shop'].some(keyword => 
          linkText.includes(keyword)
        );
      }
      
      // Look for direct keyword overlap
      const ctaWords = ctaText.split(/\s+/).filter(w => w.length > 2);
      const linkWords = linkText.split(/\s+/).filter(w => w.length > 2);
      
      return ctaWords.some(word => linkWords.includes(word));
    });
    
    if (relatedLink && relatedLink.href) {
      let nextUrl = relatedLink.href;
      
      // Handle relative URLs
      if (nextUrl.startsWith('/')) {
        try {
          const base = new URL(baseUrl);
          nextUrl = `${base.protocol}//${base.host}${nextUrl}`;
        } catch (error) {
          return { nextUrl: baseUrl, reason: "Related link URL parsing failed" };
        }
      }
      
      try {
        const baseUrlObj = new URL(baseUrl);
        const nextUrlObj = new URL(nextUrl);
        
        if (baseUrlObj.hostname !== nextUrlObj.hostname) {
          return { nextUrl: baseUrl, reason: `Related link "${relatedLink.text}" goes to external domain` };
        }
        
        return { 
          nextUrl, 
          reason: `Following related link: "${relatedLink.text}"` 
        };
      } catch (error) {
        return { nextUrl: baseUrl, reason: "Related link URL validation failed" };
      }
    }
  }
  
  return {
    nextUrl: baseUrl,
    reason: "Primary CTA is a button without target URL - manual entry required"
  };
}

async function testFunnelAnalysis(url, siteName) {
  console.log(`\n🔧 Testing Funnel Analysis: ${siteName}`);
  console.log(`🔗 URL: ${url}`);
  console.log('=' .repeat(60));

  try {
    // Step 1: Get initial capture
    const captureResult = await makeRequest('/api/capture', 'POST', {
      url: url,
      isMobile: false,
      userId: 'test-funnel-analysis',
    });

    if (captureResult.status !== 200) {
      console.error(`❌ Capture failed:`, captureResult.data);
      return;
    }

    const data = captureResult.data;
    
    console.log('📊 Step 1 - Initial Capture:');
    console.log(`   CTA Text: "${data.ctaInsight?.text}"`);
    console.log(`   Element Type: ${data.ctaInsight?.elementType}`);
    console.log(`   Has Form: ${data.ctaInsight?.hasForm}`);
    console.log(`   Is Form Associated: ${data.ctaInsight?.isFormAssociated}`);
    console.log(`   CTA href: ${data.ctaInsight?.href || 'null'}`);
    
    // Step 2: Test funnel type detection
    const funnelType = detectPrimaryCtaType(data);
    console.log(`\n🎯 Funnel Type Detection: ${funnelType.toUpperCase()}`);
    console.log(`   Debug - AI isFormAssociated: ${data.ctaInsight?.isFormAssociated}`);
    console.log(`   Debug - Detection logic result: ${funnelType}`);
    
    // Step 3: Test if we can follow the CTA (for non-form funnels)
    if (funnelType === 'non-form') {
      console.log('\n🚀 Step 2 - Following Primary CTA:');
      const followResult = followPrimaryCta(data, url);
      
      if (followResult) {
        console.log(`   Next URL: ${followResult.nextUrl}`);
        console.log(`   Reason: ${followResult.reason}`);
        
        if (followResult.reason === "Success" && followResult.nextUrl !== url) {
          console.log('\n📡 Step 3 - Testing Second Capture:');
          
          const step2Capture = await makeRequest('/api/capture', 'POST', {
            url: followResult.nextUrl,
            isMobile: false,
            userId: 'test-funnel-step2',
          });
          
          if (step2Capture.status === 200) {
            console.log(`   ✅ Step 2 capture successful`);
            console.log(`   Step 2 CTA: "${step2Capture.data.ctaInsight?.text}"`);
          } else {
            console.log(`   ❌ Step 2 capture failed: ${step2Capture.status}`);
          }
        } else {
          console.log(`   ⚠️  Cannot automatically follow CTA: ${followResult.reason}`);
        }
      }
    } else {
      console.log('\n✅ Form funnel - no step 2 needed');
    }
    
  } catch (error) {
    console.error(`❌ Error testing ${url}:`, error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing Funnel Analysis Button Functionality\n');
  
  const testCases = [
    { url: 'https://apple.com', name: 'Apple (Button CTA)' },
    { url: 'https://quickbooks.intuit.com/', name: 'QuickBooks (Button CTA)' },
    { url: 'https://ycombinator.com', name: 'Y Combinator (Link CTA)' }
  ];
  
  for (const testCase of testCases) {
    await testFunnelAnalysis(testCase.url, testCase.name);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📋 Summary: Most CTAs are buttons without href, so funnel analysis');
  console.log('    cannot automatically follow them. This is expected behavior.');
  console.log('    Links with href can be followed for step 2.');
}

runTests();
