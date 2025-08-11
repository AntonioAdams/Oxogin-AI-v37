#!/usr/bin/env node

/**
 * Debug CTR mismatch: 4.6% in funnel vs 3.7% in main analysis
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

function debugGetPrimaryCTAPerformance(captureResult) {
  const fallback = {
    ctr: 5.0,
    predictedClicks: 50,
    wastedSpend: 0,
    wastedClicks: 0,
    confidence: 'low',
    text: 'Unknown CTA'
  };
  
  // FIXED: Prioritize AI CTA insight text over prediction engine
  let ctaText = fallback.text;
  if (captureResult.ctaInsight?.text) {
    ctaText = captureResult.ctaInsight.text;
  }
  
  console.log("🔍 Debug CTR Performance Function:");
  console.log(`   AI CTA Text: "${ctaText}"`);
  console.log(`   Primary CTA Prediction Text: "${captureResult.primaryCTAPrediction?.text}"`);
  console.log(`   Click Predictions Count: ${captureResult.clickPredictions?.length || 0}`);
  
  if (captureResult.clickPredictions) {
    console.log("   Available Click Predictions:");
    captureResult.clickPredictions.forEach((p, i) => {
      const ctr = p.ctr || (p.clickProbability ? (p.clickProbability * 100).toFixed(1) : 'N/A');
      console.log(`     ${i + 1}. "${p.text}" - CTR: ${ctr}%`);
    });
  }
  
  // Try to find performance data that matches the AI-detected CTA
  if (captureResult.clickPredictions && Array.isArray(captureResult.clickPredictions) && captureResult.clickPredictions.length > 0) {
    // Look for exact or partial match with AI CTA text
    const matchingPrediction = captureResult.clickPredictions.find(p => {
      if (!p.text || !ctaText) return false;
      const pText = p.text.toLowerCase().trim();
      const ctaTextLower = ctaText.toLowerCase().trim();
      
      // More flexible matching for common variations
      const isExactMatch = pText === ctaTextLower;
      const isPartialMatch = pText.includes(ctaTextLower) || ctaTextLower.includes(pText);
      const isApplyMatch = (ctaTextLower.includes('apply') && pText.includes('apply'));
      
      return isExactMatch || isPartialMatch || isApplyMatch;
    });
    
    console.log(`\n🔍 Matching Logic Results:`);
    console.log(`   Looking for: "${ctaText}"`);
    console.log(`   Found matching prediction: ${matchingPrediction ? `"${matchingPrediction.text}"` : 'None'}`);
    
    if (matchingPrediction) {
      const ctrValue = matchingPrediction.ctr || (matchingPrediction.clickProbability ? matchingPrediction.clickProbability * 100 : fallback.ctr);
      console.log(`   ✅ Using matched prediction CTR: ${ctrValue.toFixed(1)}%`);
      return {
        ctr: ctrValue,
        text: ctaText,
        source: 'matched_prediction'
      };
    }
    
    // If no exact match, use highest CTR prediction but keep AI text
    const highestCTR = captureResult.clickPredictions.reduce((max, current) => {
      const currentCTR = current.ctr || (current.clickProbability ? current.clickProbability * 100 : 0);
      const maxCTR = max.ctr || (max.clickProbability ? max.clickProbability * 100 : 0);
      return currentCTR > maxCTR ? current : max;
    }, captureResult.clickPredictions[0]);
    
    if (highestCTR) {
      const ctrValue = highestCTR.ctr || (highestCTR.clickProbability ? highestCTR.clickProbability * 100 : fallback.ctr);
      console.log(`   ⚠️  No match found, using highest CTR prediction: "${highestCTR.text}" = ${ctrValue.toFixed(1)}%`);
      console.log(`   📊 But displaying AI text: "${ctaText}"`);
      return {
        ctr: ctrValue,
        text: ctaText,
        source: 'highest_prediction',
        actualPredictionText: highestCTR.text
      };
    }
  }
  
  console.log(`   ⚠️  Using fallback CTR: ${fallback.ctr}%`);
  return {
    ctr: fallback.ctr,
    text: ctaText,
    source: 'fallback'
  };
}

async function debugYCombinator() {
  console.log('🧪 Debugging Y Combinator CTR Mismatch\n');
  console.log('Expected: Main analysis shows 3.7%, funnel shows 4.6%\n');

  try {
    const captureResult = await makeRequest('/api/capture', 'POST', {
      url: 'https://ycombinator.com',
      isMobile: false,
      userId: 'debug-ctr-mismatch',
    });

    if (captureResult.status !== 200) {
      console.error(`❌ Capture failed:`, captureResult.data);
      return;
    }

    const data = captureResult.data;
    
    console.log('📊 Raw API Data:');
    console.log(`   AI CTA Insight: "${data.ctaInsight?.text}"`);
    console.log(`   Primary CTA Prediction: "${data.primaryCTAPrediction?.text}"`);
    console.log(`   Primary CTA CTR: ${data.primaryCTAPrediction?.ctr || 'null'}`);
    console.log(`   Primary CTA Click Probability: ${data.primaryCTAPrediction?.clickProbability}`);
    
    if (data.primaryCTAPrediction?.clickProbability) {
      const convertedCTR = (data.primaryCTAPrediction.clickProbability * 100).toFixed(1);
      console.log(`   Primary CTA as percentage: ${convertedCTR}%`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Debug the funnel performance calculation
    const performance = debugGetPrimaryCTAPerformance(data);
    
    console.log('\n📊 Final CTR Calculation:');
    console.log(`   Calculated CTR: ${performance.ctr.toFixed(1)}%`);
    console.log(`   Display Text: "${performance.text}"`);
    console.log(`   Data Source: ${performance.source}`);
    if (performance.actualPredictionText) {
      console.log(`   Actual Prediction Used: "${performance.actualPredictionText}"`);
    }
    
    console.log('\n🎯 Analysis:');
    if (performance.source === 'highest_prediction') {
      console.log(`   ⚠️  MISMATCH CAUSE: AI detected "${performance.text}" but no prediction exists for it.`);
      console.log(`   📊 Funnel uses highest available prediction (${performance.actualPredictionText}) = ${performance.ctr.toFixed(1)}%`);
      console.log(`   🔧 Main analysis might use different logic or different data source.`);
    }

  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }
}

debugYCombinator();

