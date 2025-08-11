import { NextRequest, NextResponse } from 'next/server'
import {
  predictStepRate,
  calculateFactorMultiplier,
  combineFactorMultipliers,
  DEFAULT_POST_CLICK_CONFIG,
  DEFAULT_POST_CLICK_FACTORS,
  type PostClickFactor,
  type PostClickStep
} from '@/lib/funnel/post-click-model'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Running Post-Click Model Tests...')
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as any[]
    }
    
    // Test 1: Basic factor multiplier calculation
    const test1 = {
      name: 'Factor Multiplier Calculation',
      input: { score: 0.8, maxLift: 0.4 },
      result: calculateFactorMultiplier(0.8, 0.4),
      expected: 1.32,
      passed: false
    }
    test1.passed = Math.abs(test1.result - test1.expected) < 0.01
    results.tests.push(test1)
    
    // Test 2: Combine multiple factors
    const testFactors: PostClickFactor[] = [
      { factor: 'message_match_scent', score: 0.8, max_lift: 0.4 },
      { factor: 'form_friction_reduction', score: 0.6, max_lift: 0.7 },
      { factor: 'page_speed_ux', score: 0.9, max_lift: 0.1 }
    ]
    
    const test2 = {
      name: 'Combine Factor Multipliers',
      input: testFactors.map(f => `${f.factor}: ${f.score} × ${f.max_lift}`),
      result: combineFactorMultipliers(testFactors, 'multiplicative'),
      expected: 2.17, // Approximate
      passed: false
    }
    test2.passed = Math.abs(test2.result - test2.expected) < 0.1
    results.tests.push(test2)
    
    // Test 3: Step rate prediction
    const testStep: PostClickStep = {
      step_name: 'Test Step 2',
      cold_base_rate: 0.10,
      audience: 'warm',
      upper_cap: 0.65
    }
    
    const prediction = predictStepRate(testStep, DEFAULT_POST_CLICK_CONFIG, testFactors)
    
    const test3 = {
      name: 'Step Rate Prediction',
      input: {
        baseRate: testStep.cold_base_rate,
        audience: testStep.audience,
        factors: testFactors.length
      },
      result: {
        predictedRate: prediction.predicted_rate,
        baseWithWarmth: prediction.cold_base_rate * prediction.warmth_multiplier_applied,
        factorMultiplier: prediction.combined_factor_multiplier
      },
      expected: {
        predictedRate: 0.54, // Approximate
        factorMultiplier: 2.17
      },
      passed: false
    }
    test3.passed = Math.abs(test3.result.predictedRate - test3.expected.predictedRate) < 0.1
    results.tests.push(test3)
    
    // Test 4: Default configuration validation
    const test4 = {
      name: 'Default Configuration Validation',
      input: {
        factors: DEFAULT_POST_CLICK_FACTORS.length,
        config: DEFAULT_POST_CLICK_CONFIG.mode
      },
      result: {
        factorCount: DEFAULT_POST_CLICK_FACTORS.length,
        totalMaxLift: DEFAULT_POST_CLICK_FACTORS.reduce((sum, f) => sum + f.max_lift, 0),
        averageScore: DEFAULT_POST_CLICK_FACTORS.reduce((sum, f) => sum + f.score, 0) / DEFAULT_POST_CLICK_FACTORS.length
      },
      expected: {
        factorCount: 7,
        minTotalLift: 2.0
      },
      passed: false
    }
    test4.passed = test4.result.factorCount === test4.expected.factorCount && 
                   test4.result.totalMaxLift >= test4.expected.minTotalLift
    results.tests.push(test4)
    
    // Test 5: Edge case handling
    const edgeFactors: PostClickFactor[] = [
      { factor: 'edge_test', score: 0, max_lift: 1.0 }, // Minimum score
      { factor: 'edge_test_2', score: 1, max_lift: 0.5 } // Maximum score
    ]
    
    const test5 = {
      name: 'Edge Case Handling',
      input: edgeFactors,
      result: combineFactorMultipliers(edgeFactors, 'multiplicative'),
      expected: 1.5, // 1.0 × 1.5 = 1.5
      passed: false
    }
    test5.passed = Math.abs(test5.result - test5.expected) < 0.01
    results.tests.push(test5)
    
    // Calculate overall results
    const passedTests = results.tests.filter(t => t.passed).length
    const totalTests = results.tests.length
    
    const summary = {
      passed: passedTests,
      total: totalTests,
      success: passedTests === totalTests,
      successRate: (passedTests / totalTests * 100).toFixed(1) + '%'
    }
    
    console.log(`✅ Tests completed: ${summary.successRate} (${summary.passed}/${summary.total})`)
    
    return NextResponse.json({
      ...results,
      summary,
      message: summary.success 
        ? '🎉 All tests passed! Post-click model is working correctly.'
        : '⚠️ Some tests failed. Check the results for details.'
    })
    
  } catch (error) {
    console.error('❌ Test error:', error)
    return NextResponse.json(
      { error: 'Test execution failed', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { factors, step, config } = body
    
    // Allow custom test scenarios via POST
    const customFactors = factors || DEFAULT_POST_CLICK_FACTORS
    const customStep = step || {
      step_name: 'Custom Test Step',
      cold_base_rate: 0.10,
      audience: 'warm',
      upper_cap: 0.65
    }
    const customConfig = config || DEFAULT_POST_CLICK_CONFIG
    
    const prediction = predictStepRate(customStep, customConfig, customFactors)
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      input: { factors: customFactors, step: customStep, config: customConfig },
      prediction,
      analysis: {
        baseRateContribution: customStep.cold_base_rate,
        warmthContribution: prediction.warmth_multiplier_applied - 1,
        factorContribution: prediction.combined_factor_multiplier - 1,
        totalLift: prediction.predicted_rate / customStep.cold_base_rate - 1
      }
    })
    
  } catch (error) {
    console.error('❌ Custom test error:', error)
    return NextResponse.json(
      { error: 'Custom test failed', details: error.message },
      { status: 500 }
    )
  }
}
