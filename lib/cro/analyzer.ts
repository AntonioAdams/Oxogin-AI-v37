// Main CRO Analyzer - Orchestrates the entire CRO analysis process
import { TokenExtractor } from './token-extractor';
import { RecommendationEngine } from './recommendation-engine';
import { CaptureData, CROAnalysisResult, DOMTokens } from './types';

export class CROAnalyzer {
  private tokenExtractor: TokenExtractor;
  private recommendationEngine: RecommendationEngine;

  constructor() {
    this.tokenExtractor = new TokenExtractor();
    this.recommendationEngine = new RecommendationEngine();
  }

  /**
   * Main analysis method - takes capture data and returns CRO recommendations
   */
  async analyze(captureData: CaptureData): Promise<CROAnalysisResult> {
    try {
      // Step 1: Extract tokens from DOM data
      const tokens = await this.tokenExtractor.extractTokens(captureData);

      // Step 2: Generate recommendations based on tokens
      const recommendations = await this.recommendationEngine.generateRecommendations(tokens);

      // Step 3: Calculate summary metrics
      const summary = this.calculateSummary(recommendations);

      // Step 4: Build result object
      const result: CROAnalysisResult = {
        recommendations,
        summary,
        tokens,
        metadata: {
          analyzedAt: new Date().toISOString(),
          url: captureData.domData.url,
          deviceType: captureData.isMobile ? 'mobile' : 'desktop',
          analysisVersion: '1.0.0'
        }
      };

      return result;

    } catch (error) {
      console.error('[CRO Analyzer] Analysis failed:', error);
      throw new Error(`CRO analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate summary statistics from recommendations
   */
  private calculateSummary(recommendations: any[]) {
    const quickWins = recommendations.filter(r => r.category === 'Quick Wins').length;
    const formFixes = recommendations.filter(r => r.category === 'Form Fixes').length;
    const structuralChanges = recommendations.filter(r => r.category === 'Structural Changes').length;

    // Calculate estimated uplift range from all recommendations
    let minUplift = 0;
    let maxUplift = 0;

    recommendations.forEach(rec => {
      if (rec.estimatedUplift) {
        minUplift += rec.estimatedUplift.min;
        maxUplift += rec.estimatedUplift.max;
      }
    });

    return {
      totalRecommendations: recommendations.length,
      quickWins,
      formFixes,
      structuralChanges,
      estimatedUpliftRange: {
        min: Math.round(minUplift),
        max: Math.round(maxUplift)
      }
    };
  }

  /**
   * Validate capture data before analysis
   */
  private validateCaptureData(captureData: CaptureData): void {
    if (!captureData?.domData) {
      throw new Error('Missing DOM data in capture');
    }

    if (!captureData.domData.url) {
      throw new Error('Missing URL in capture data');
    }

    if (!Array.isArray(captureData.domData.buttons)) {
      throw new Error('Invalid buttons data in capture');
    }

    if (!Array.isArray(captureData.domData.links)) {
      throw new Error('Invalid links data in capture');
    }

    if (!Array.isArray(captureData.domData.forms)) {
      throw new Error('Invalid forms data in capture');
    }

    if (!Array.isArray(captureData.domData.formFields)) {
      throw new Error('Invalid form fields data in capture');
    }
  }

  /**
   * Get analysis for specific device type (desktop/mobile)
   */
  async analyzeDevice(captureData: CaptureData, deviceType: 'desktop' | 'mobile'): Promise<CROAnalysisResult> {
    // Override device type if needed
    const deviceSpecificData = {
      ...captureData,
      isMobile: deviceType === 'mobile'
    };

    return this.analyze(deviceSpecificData);
  }

  /**
   * Quick analysis method that returns just high-priority recommendations
   */
  async quickAnalysis(captureData: CaptureData, maxRecommendations: number = 5): Promise<CROAnalysisResult> {
    const fullAnalysis = await this.analyze(captureData);
    
    // Return only top recommendations by priority
    const topRecommendations = fullAnalysis.recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxRecommendations);

    return {
      ...fullAnalysis,
      recommendations: topRecommendations,
      summary: {
        ...fullAnalysis.summary,
        totalRecommendations: topRecommendations.length
      }
    };
  }
}

// Export singleton instance
export const croAnalyzer = new CROAnalyzer();

