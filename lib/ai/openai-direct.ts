// Direct OpenAI API client using Vercel AI SDK
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { compressScreenshotForOpenAI, validatePayloadSize, SIZE_LIMITS } from '@/lib/utils/screenshot-compression';

export interface CTAAnalysisResult {
  text: string;
  confidence: number;
  hasForm: boolean;
  reasoning: string;
  elementType: 'button' | 'link' | 'form';
  alternativeTexts: string[];
}

export async function analyzeCTADirect(
  imageBase64: string,
  deviceType: 'desktop' | 'mobile' = 'desktop',
  model: string = 'gpt-4o-mini'
): Promise<CTAAnalysisResult> {
  try {
    // Compress the screenshot for OpenAI
    const compressedImage = await compressScreenshotForOpenAI(imageBase64, deviceType)
    
    // Remove data URL prefix for OpenAI
    const base64Data = compressedImage.replace(/^data:image\/[a-z]+;base64,/, '')

    const prompt = `Identify the primary CTA element in this screenshot. Respond with JSON only.

JSON FORMAT:
{
  "text": "exact button text",
  "confidence": 0.8,
  "hasForm": true,
  "isFormAssociated": true,
  "reasoning": "explanation",
  "elementType": "button",
  "alternativeTexts": ["alt1", "alt2"]
}

PRIORITY RULES (in order):
1. Forms above fold (0-800px) → Primary
2. Visually prominent buttons above fold (Hero > Header > other)
3. Action-oriented CTAs over navigation ("Buy" > "Mac")
4. Ignore: navigation, privacy banners, search bars, cookie acceptance buttons

VISUAL PROMINENCE:
- Size: Large buttons (>100px) > small buttons (<50px)
- Color: High contrast, unique colors that stand out
- Position: Centered, hero section, significant whitespace
- Style: Button styling, shadows, clickable appearance

Focus on the ONE conversion action users should take.

FORM ASSOCIATION:
- isFormAssociated: true = CTA submits form data that is VISIBLE on current page (Submit, Sign Up, Get Started WITH visible form fields)
- isFormAssociated: false = CTA navigates to other pages (Learn More, About, View Products) OR is for commerce/purchasing (Buy Now, Shop, Add to Cart)
- CRITICAL: Do NOT guess about forms on other pages. Only consider visible elements.
- COMMERCE CTAs: "Buy", "Shop", "Purchase", "Add to Cart" = isFormAssociated: false
- hasForm: true/false = ANY form exists on current page
- isFormAssociated: true/false = PRIMARY CTA submits visible form on current page`;

    const messages: any[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image',
            image: compressedImage,
          },
        ],
      },
    ]

    const requestPayload = {
      model: model,
      messages,
      temperature: 0.1,
      maxTokens: 1000,
    }

    // Validate payload size before sending to OpenAI
    const validation = validatePayloadSize(requestPayload, SIZE_LIMITS.SAFE_PAYLOAD, `Direct CTA Analysis (${deviceType})`)
    
    if (!validation.isValid) {
      console.error(`[OpenAI Direct] ${validation.error}`)
      throw new Error(`Payload too large: ${validation.sizeKB}KB exceeds ${validation.limitKB}KB limit. Screenshot compression may have failed.`)
    }

    const result = await generateText({
      model: openai(model),
      messages,
      temperature: 0.1,
      maxTokens: 1000,
    })

    const content = result.text;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsedResult = JSON.parse(jsonMatch[0]) as CTAAnalysisResult;
    return parsedResult;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`Failed to analyze CTA: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateCROAnalysisDirect(
  prompt: string,
  model: string = 'gpt-4o'
): Promise<string> {
  try {
    const result = await generateText({
      model: openai(model),
      prompt,
      temperature: 0.3,
      maxTokens: 2000,
    })

    return result.text || '';
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`Failed to generate CRO analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 