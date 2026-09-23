import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

if (!apiKey) {
  throw new Error('Missing VITE_GEMINI_API_KEY environment variable')
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(apiKey)

/**
 * Get Gemini model configured for JSON output
 */
export function getGeminiModel() {
  // 1.5 model IDs (e.g. gemini-1.5-pro) return 404 on current API; use 2.5+ IDs.
  // See https://ai.google.dev/gemini-api/docs/models/gemini
  const model =
    import.meta.env.VITE_GEMINI_MODEL?.trim() || 'gemini-2.5-flash'

  return genAI.getGenerativeModel({
    model,
    generationConfig: {
      temperature: 0.7,          // Balance creativity and consistency
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,     // Enough for 15 detailed items
      responseMimeType: 'application/json',  // Force raw JSON — no markdown wrapping
    }
  })
}

/**
 * Test Gemini API connection
 */
export async function testGeminiConnection() {
  try {
    const model = getGeminiModel()
    const result = await model.generateContent('Say "Hello from Gemini!"')
    const response = await result.response
    const text = response.text()
    console.log('Gemini API connected:', text)
    return true
  } catch (error) {
    console.error('Gemini API connection failed:', error)
    return false
  }
}