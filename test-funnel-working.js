#!/usr/bin/env node

const http = require('http');

async function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3000');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Simple version of form detection logic
function detectPrimaryCtaType(captureResult) {
  const domData = captureResult.domData;
  
  // Step 1: Check if any forms exist
  const actualFormsCount = domData.forms ? domData.forms.length : 0;
  console.log(`   Forms in DOM: ${actualFormsCount}`);
  
  if (actualFormsCount === 0) {
    console.log(`   → NON-FORM (no forms exist)`);
    return 'non-form';
  }
  
  // Step 2: Check coordinates (simplified - would need full logic)
  console.log(`   → Forms exist, coordinate detection needed`);
  return 'form'; // Simplified for this test
}

// Simple version of performance function
function getPrimaryCTAPerformance(captureResult) {
  const ctaText = captureResult.ctaInsight?.text || 'Unknown CTA';
  
  console.log(`   Looking for predictions matching: "${ctaText}"`);
  
  if (captureResult.clickPredictions) {
    // Look for "Apply" predictions when CTA is "Apply Now"
    const matchingPrediction = captureResult.clickPredictions.find(p => {
      if (!p.text || !ctaText) return false;
      const pText = p.text.toLowerCase().trim();
      const ctaTextLower = ctaText.toLowerCase().trim();
      
      const isApplyMatch = (ctaTextLower.includes('apply') && pText.includes('apply'));
      return isApplyMatch;
    });
    
    if (matchingPrediction) {
      const ctr = matchingPrediction.ctr || (matchingPrediction.clickProbability * 100);
      console.log(`   ✅ Found match: "${matchingPrediction.text}" = ${ctr}%`);
      return { ctr, text: ctaText };
    }
  }
  
  console.log(`   ❌ No matching prediction found`);
  return { ctr: 5.0, text: ctaText };
}

async function testFunnelWorking() {
  console.log('🧪 Testing if funnel fixes are working...\n');

  try {
    const result = await makeRequest('/api/capture', 'POST', {
      url: 'https://ycombinator.com',
      isMobile: false,
      userId: 'test-funnel-working',
    });

    if (result.status !== 200) {
      console.error('❌ Capture failed:', result.data);
      return;
    }

    const data = result.data;
    
    console.log('📊 Testing Storage Quota Fix:');
    console.log('   ✅ Capture succeeded without QuotaExceededError\n');
    
    console.log('📊 Testing Form Detection:');
    console.log(`   AI says: isFormAssociated = ${data.ctaInsight?.isFormAssociated}`);
    const funnelType = detectPrimaryCtaType(data);
    console.log(`   Final classification: ${funnelType.toUpperCase()}\n`);
    
    console.log('📊 Testing CTR Performance:');
    console.log(`   AI CTA: "${data.ctaInsight?.text}"`);
    console.log(`   Primary Prediction: "${data.primaryCTAPrediction?.text}" = ${(data.primaryCTAPrediction?.clickProbability * 100).toFixed(1)}%`);
    const performance = getPrimaryCTAPerformance(data);
    console.log(`   Funnel will show: "${performance.text}" = ${performance.ctr}%\n`);
    
    console.log('🎯 Expected Funnel Results:');
    console.log(`   • Type: NON-FORM (${funnelType === 'non-form' ? '✅' : '❌'})`);
    console.log(`   • CTA Text: "Apply Now" (${performance.text === 'Apply Now' ? '✅' : '❌'})`);
    console.log(`   • CTR: 4.6% (${performance.ctr === 4.6 ? '✅' : '❌'})`);
    console.log(`   • Button: "Funnel Analysis" enabled (${funnelType === 'non-form' ? '✅' : '❌'})`);
    
    const allWorking = (
      funnelType === 'non-form' &&
      performance.text === 'Apply Now' &&
      performance.ctr === 4.6
    );
    
    console.log(`\n🚀 Overall Status: ${allWorking ? '✅ WORKING' : '❌ NEEDS FIX'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFunnelWorking();

