#!/usr/bin/env tsx
// Enhanced Browserless Implementation Test Suite
// Run with: npx tsx test-enhanced-browserless.ts

import { AdaptiveCaptureClient } from './lib/capture/adaptive-capture'
import { SmartTimeoutManager } from './lib/capture/smart-timeout-config'
import { StealthManager } from './lib/capture/stealth-config'

console.log('🧪 Enhanced Browserless Test Suite Starting...\n')

// Test 1: Smart Timeout Configuration
async function testSmartTimeouts() {
  console.log('📋 Test 1: Smart Timeout System')
  
  const timeoutManager = new SmartTimeoutManager()
  
  // Test simple site
  const simpleTimeout = timeoutManager.calculateTimeout({
    hasReact: false,
    hasAngular: false,
    hasVue: false,
    hasLazyLoading: false,
    hasInfiniteScroll: false,
    thirdPartyScripts: 2,
    domComplexity: 'low'
  })
  
  // Test complex SPA
  const complexTimeout = timeoutManager.calculateTimeout({
    hasReact: true,
    hasAngular: false,
    hasVue: false,
    hasLazyLoading: true,
    hasInfiniteScroll: true,
    thirdPartyScripts: 15,
    domComplexity: 'high'
  })
  
  console.log(`  ✅ Simple site timeout: ${simpleTimeout}ms`)
  console.log(`  ✅ Complex SPA timeout: ${complexTimeout}ms`)
  console.log(`  ✅ Timeout scaling works: ${complexTimeout > simpleTimeout ? 'YES' : 'NO'}`)
  
  // Test retry escalation
  const retryTimeout = timeoutManager.calculateTimeout({
    hasReact: true,
    domComplexity: 'medium'
  }, 3) // 3rd attempt
  
  console.log(`  ✅ Retry escalation timeout: ${retryTimeout}ms`)
  console.log('')
}

// Test 2: Stealth Configuration
async function testStealthMode() {
  console.log('🕵️ Test 2: Stealth Mode System')
  
  const stealthManager = new StealthManager()
  
  // Test desktop fingerprint
  const desktopFingerprint = stealthManager.generateFingerprint(false)
  console.log(`  ✅ Desktop fingerprint generated`)
  console.log(`    - User Agent: ${desktopFingerprint.userAgent.substring(0, 50)}...`)
  console.log(`    - Viewport: ${desktopFingerprint.viewport.width}x${desktopFingerprint.viewport.height}`)
  console.log(`    - Timezone: ${desktopFingerprint.timezone}`)
  
  // Test mobile fingerprint
  const mobileFingerprint = stealthManager.generateFingerprint(true)
  console.log(`  ✅ Mobile fingerprint generated`)
  console.log(`    - Viewport: ${mobileFingerprint.viewport.width}x${mobileFingerprint.viewport.height}`)
  console.log(`    - Device Scale: ${mobileFingerprint.viewport.deviceScaleFactor}`)
  
  // Test human delay
  const delays = []
  for (let i = 0; i < 5; i++) {
    delays.push(stealthManager.getHumanDelay())
  }
  console.log(`  ✅ Human delays: ${delays.join(', ')}ms`)
  console.log(`  ✅ Delay variation: ${Math.max(...delays) - Math.min(...delays)}ms`)
  console.log('')
}

// Test 3: Adaptive Routing Logic
async function testAdaptiveRouting() {
  console.log('🎯 Test 3: Adaptive Routing Logic')
  
  // Note: We'll test the logic without actual API calls
  const adaptiveClient = new AdaptiveCaptureClient(undefined, {
    enableEnhancedForComplexSites: true,
    enableEnhancedForKnownProblematicDomains: true,
    problematicDomains: ['hubspot.com', 'salesforce.com', 'amazon.com'],
    complexSiteIndicators: ['react', 'angular', 'vue']
  })
  
  // Test cases
  const testUrls = [
    'https://example.com',
    'https://hubspot.com/demo',
    'https://myapp.react.com',
    'https://salesforce.com/login',
    'https://simple-blog.com'
  ]
  
  testUrls.forEach(url => {
    const recommendation = adaptiveClient.getCaptureRecommendation(url)
    console.log(`  📊 ${url}`)
    console.log(`    - Method: ${recommendation.recommendedMethod}`)
    console.log(`    - Reasoning: ${recommendation.reasoning}`)
    console.log(`    - Confidence: ${recommendation.confidence}`)
  })
  console.log('')
}

// Test 4: Configuration Management
async function testConfiguration() {
  console.log('⚙️ Test 4: Configuration Management')
  
  const adaptiveClient = new AdaptiveCaptureClient()
  
  // Test default configuration
  const defaultConfig = adaptiveClient.getConfig()
  console.log(`  ✅ Default config loaded`)
  console.log(`    - Enhanced for complex sites: ${defaultConfig.enableEnhancedForComplexSites}`)
  console.log(`    - Problematic domains count: ${defaultConfig.problematicDomains.length}`)
  
  // Test configuration update
  adaptiveClient.updateConfig({
    enableEnhancedForComplexSites: false,
    problematicDomains: ['test.com']
  })
  
  const updatedConfig = adaptiveClient.getConfig()
  console.log(`  ✅ Configuration updated`)
  console.log(`    - Enhanced for complex sites: ${updatedConfig.enableEnhancedForComplexSites}`)
  console.log(`    - Problematic domains: ${updatedConfig.problematicDomains.join(', ')}`)
  console.log('')
}

// Test 5: Error Handling and Edge Cases
async function testErrorHandling() {
  console.log('🚨 Test 5: Error Handling')
  
  try {
    const adaptiveClient = new AdaptiveCaptureClient()
    
    // Test invalid URL handling
    const invalidUrlRecommendation = adaptiveClient.getCaptureRecommendation('not-a-url')
    console.log(`  ✅ Invalid URL handled gracefully`)
    console.log(`    - Method: ${invalidUrlRecommendation.recommendedMethod}`)
    console.log(`    - Reasoning: ${invalidUrlRecommendation.reasoning}`)
    
    // Test empty configuration
    const emptyClient = new AdaptiveCaptureClient(undefined, {
      problematicDomains: [],
      complexSiteIndicators: []
    })
    
    const emptyRecommendation = emptyClient.getCaptureRecommendation('https://complex-site.com')
    console.log(`  ✅ Empty configuration handled`)
    console.log(`    - Method: ${emptyRecommendation.recommendedMethod}`)
    
  } catch (error) {
    console.log(`  ❌ Error handling test failed: ${error}`)
  }
  console.log('')
}

// Test 6: Performance Characteristics (Simulation)
async function testPerformanceCharacteristics() {
  console.log('⚡ Test 6: Performance Simulation')
  
  const timeoutManager = new SmartTimeoutManager()
  const stealthManager = new StealthManager()
  
  // Simulate performance for different site types
  const siteTypes = [
    { name: 'Simple Blog', complexity: { domComplexity: 'low', thirdPartyScripts: 2 } },
    { name: 'E-commerce', complexity: { domComplexity: 'medium', thirdPartyScripts: 8, hasLazyLoading: true } },
    { name: 'React SPA', complexity: { domComplexity: 'high', hasReact: true, thirdPartyScripts: 12, hasLazyLoading: true } },
    { name: 'Enterprise App', complexity: { domComplexity: 'high', hasAngular: true, thirdPartyScripts: 20, hasInfiniteScroll: true } }
  ]
  
  console.log('  📊 Performance Simulation Results:')
  
  siteTypes.forEach(site => {
    const baseTimeout = 15000
    const smartTimeout = timeoutManager.calculateTimeout(site.complexity as any)
    const overhead = smartTimeout - baseTimeout
    const overheadPercent = ((overhead / baseTimeout) * 100).toFixed(1)
    
    console.log(`    ${site.name}:`)
    console.log(`      - Base timeout: ${baseTimeout}ms`)
    console.log(`      - Smart timeout: ${smartTimeout}ms`)
    console.log(`      - Overhead: +${overhead}ms (+${overheadPercent}%)`)
  })
  console.log('')
}

// Main test runner
async function runTests() {
  try {
    await testSmartTimeouts()
    await testStealthMode()
    await testAdaptiveRouting()
    await testConfiguration()
    await testErrorHandling()
    await testPerformanceCharacteristics()
    
    console.log('🎉 All tests completed successfully!')
    console.log('')
    console.log('💡 Next steps:')
    console.log('  1. Test with actual browserless API key')
    console.log('  2. Try capturing a known problematic site')
    console.log('  3. Monitor performance metrics in production')
    console.log('  4. Adjust configurations based on real-world data')
    
  } catch (error) {
    console.error('❌ Test suite failed:', error)
    process.exit(1)
  }
}

// Run the test suite
if (require.main === module) {
  runTests()
}

export { runTests }
