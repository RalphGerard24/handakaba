import { getGeminiModel } from '../lib/gemini'
import { buildChecklistPrompt, validateChecklistResponse } from '../lib/checklistPrompt'
import { supabase } from '../lib/supabase'


/**
 * Generate personalized disaster preparedness checklist
 * using Google Gemini AI
 */
export async function generateChecklist(userId) {
  try {
    const { profile, riskScores } = await getUserDataForChecklist(userId)
    
    if (!profile || !riskScores) {
      throw new Error('Missing user profile or risk scores')
    }
    
    const prompt = buildChecklistPrompt(profile, riskScores)
    
    const model = getGeminiModel()
    
    // Retry logic with exponential backoff for 503 and 429 errors
    let result = null
    let maxRetries = 3
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        result = await model.generateContent(prompt)
        break // Success
      } catch (err) {
        if (attempt === maxRetries) throw err
        
        // Check if error is a rate limit or service unavailable
        if (err.message && (err.message.includes('503') || err.message.includes('429'))) {
          const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000 // Exponential backoff with jitter
          console.warn(`Gemini API high demand (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delayMs)}ms...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        } else {
          throw err // Not a retryable error
        }
      }
    }

    const response = await result.response
    let text = response.text()
    
    text = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    // Strategy 1: try to parse the whole text
    // Strategy 2: extract the first {...} block (handles leading/trailing prose)
    let checklistData
    let parseError = null
    try {
      checklistData = JSON.parse(text)
    } catch (e1) {
      parseError = e1
      // Find the outermost JSON object
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          checklistData = JSON.parse(match[0])
          parseError = null
        } catch (e2) {
          parseError = e2
        }
      }
    }

    if (parseError || !checklistData) {
      console.error('JSON parse failed. Raw response (first 800 chars):', text.substring(0, 800))
      throw new Error('Failed to parse Gemini response as JSON')
    }
    
    const validation = validateChecklistResponse(checklistData)
    if (!validation.isValid) {
      console.error('Validation errors:', validation.errors)
      throw new Error(`Invalid checklist: ${validation.errors.join(', ')}`)
    }
    
    await saveChecklistToDatabase(userId, checklistData.items)
    
    return {
      success: true,
      items: checklistData.items
    }
    
  } catch (error) {
    console.error('Checklist generation error:', error)
    
    // Return fallback generic checklist
    return {
      success: false,
      error: error.message,
      items: await getFallbackChecklist(userId)
    }
  }
}

/**
 * Get user profile and risk scores for checklist generation
 */
async function getUserDataForChecklist(userId) {
  try {
    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (profileError) throw profileError
    
    // Get risk scores
    const { data: riskScores, error: riskError } = await supabase
      .from('risk_scores')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (riskError) throw riskError
    
    return { profile, riskScores }
    
  } catch (error) {
    console.error('Error fetching user data:', error)
    throw error
  }
}

/**
 * Save checklist items to database
 */
async function saveChecklistToDatabase(userId, items) {
  try {
    // Delete existing checklist
    const { error: deleteError } = await supabase
      .from('checklist_items')
      .delete()
      .eq('user_id', userId)
    
    if (deleteError) throw deleteError
    
    // Insert new checklist
    const checklistItems = items.map(item => ({
      user_id: userId,
      rank: item.rank,
      category: item.category,
      task: item.task,
      task_tl: item.task_tl || item.task,
      reason: item.reason,
      reason_tl: item.reason_tl || item.reason,
      estimated_cost: item.estimated_cost,
      urgency: item.urgency,
      completed: false
    }))
    
    const { error: insertError } = await supabase
      .from('checklist_items')
      .insert(checklistItems)
    
    if (insertError) throw insertError
    
    return true
    
  } catch (error) {
    console.error('Error saving checklist:', error)
    throw error
  }
}

/**
 * Fallback generic checklist if API fails
 */
async function getFallbackChecklist(userId) {
  console.log('Using fallback generic checklist')
  
  // Get risk scores to prioritize
  const { data: riskScores } = await supabase
    .from('risk_scores')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  const hasHighFlood = riskScores?.flood_risk === 'HIGH'
  const hasHighEarthquake = riskScores?.earthquake_risk === 'HIGH'
  
  const genericChecklist = [
    {
      rank: 1,
      category: 'Emergency Supplies',
      task: 'Assemble 72-hour emergency kit with food, water, first aid',
      task_tl: 'Bumuo ng 72-hour emergency kit na may pagkain, tubig, at first aid',
      reason: 'Essential for any disaster situation',
      reason_tl: 'Mahalaga para sa anumang sitwasyon ng sakuna',
      estimated_cost: 3000,
      urgency: 'CRITICAL'
    },
    {
      rank: 2,
      category: 'Evacuation Planning',
      task: 'Identify 3 evacuation routes from your area',
      task_tl: 'Tukuyin ang 3 evacuation routes mula sa iyong lugar',
      reason: hasHighFlood ? 'High flood risk requires evacuation plan' : 'Important for any emergency',
      reason_tl: hasHighFlood ? 'Ang mataas na panganib sa baha ay nangangailangan ng evacuation plan' : 'Mahalaga para sa anumang emergency',
      estimated_cost: 0,
      urgency: hasHighFlood ? 'CRITICAL' : 'HIGH'
    },
    {
      rank: 3,
      category: 'Communication',
      task: 'Create family emergency contact list',
      task_tl: 'Gumawa ng listahan ng mga emergency contact ng pamilya',
      reason: 'Stay connected during disasters',
      reason_tl: 'Manatiling konektado sa panahon ng mga sakuna',
      estimated_cost: 0,
      urgency: 'CRITICAL'
    },
    {
      rank: 4,
      category: 'Home Safety',
      task: 'Secure heavy furniture and appliances',
      task_tl: 'I-secure o itali ang mga mabibigat na kasangkapan at appliances',
      reason: hasHighEarthquake ? 'High earthquake risk requires securing items' : 'Prevents injuries during earthquakes',
      reason_tl: hasHighEarthquake ? 'Ang mataas na panganib sa lindol ay nangangailangan ng pag-secure ng mga gamit' : 'Pinipigilan ang mga pinsala sa panahon ng lindol',
      estimated_cost: 500,
      urgency: hasHighEarthquake ? 'CRITICAL' : 'HIGH'
    },
    {
      rank: 5,
      category: 'Financial',
      task: 'Keep emergency cash fund (₱5,000-₱10,000)',
      task_tl: 'Magtabi ng emergency cash fund (₱5,000-₱10,000)',
      reason: 'ATMs may be unavailable after disasters',
      reason_tl: 'Maaaring hindi magamit ang mga ATM pagkatapos ng sakuna',
      estimated_cost: 5000,
      urgency: 'HIGH'
    },
    {
      rank: 6,
      category: 'Medical',
      task: 'Stock 1-month supply of essential medications',
      task_tl: 'Mag-imbak ng 1-buwang supply ng mga mahahalagang gamot',
      reason: 'Medical facilities may be overwhelmed',
      reason_tl: 'Maaaring mapuno ang mga pasilidad na medikal',
      estimated_cost: 2000,
      urgency: 'HIGH'
    },
    {
      rank: 7,
      category: 'Documentation',
      task: 'Scan important documents (IDs, property papers, insurance)',
      task_tl: 'I-scan ang mga mahahalagang dokumento (ID, titulo ng lupa, insurance)',
      reason: 'Protects vital records from damage',
      reason_tl: 'Pinoprotektahan ang mga mahahalagang rekord mula sa pagkasira',
      estimated_cost: 100,
      urgency: 'HIGH'
    },
    {
      rank: 8,
      category: 'Emergency Supplies',
      task: 'Buy battery-powered or hand-crank radio',
      task_tl: 'Bumili ng radyo na pinapatakbo ng baterya o hand-crank',
      reason: 'Stay informed during power outages',
      reason_tl: 'Manatiling may alam sa panahon ng brownout',
      estimated_cost: 800,
      urgency: 'MEDIUM'
    },
    {
      rank: 9,
      category: 'Home Safety',
      task: 'Install smoke alarms and fire extinguisher',
      task_tl: 'Mag-install ng smoke alarms at fire extinguisher',
      reason: 'Fire safety is crucial year-round',
      reason_tl: 'Mahalaga ang kaligtasan sa sunog sa buong taon',
      estimated_cost: 1500,
      urgency: 'MEDIUM'
    },
    {
      rank: 10,
      category: 'Evacuation Planning',
      task: 'Pack go-bags for each family member',
      task_tl: 'Mag-impake ng go-bags para sa bawat miyembro ng pamilya',
      reason: 'Ready for immediate evacuation',
      reason_tl: 'Handa para sa agarang paglikas',
      estimated_cost: 2000,
      urgency: 'MEDIUM'
    },
    {
      rank: 11,
      category: 'Emergency Supplies',
      task: 'Buy flashlights and extra batteries',
      task_tl: 'Bumili ng flashlights at karagdagang baterya',
      reason: 'Essential for power outages',
      reason_tl: 'Mahalaga para sa mga power outage o brownout',
      estimated_cost: 500,
      urgency: 'MEDIUM'
    },
    {
      rank: 12,
      category: 'Communication',
      task: 'Save emergency hotlines in phone (911, barangay)',
      task_tl: 'I-save ang mga emergency hotline sa telepono (911, barangay)',
      reason: 'Quick access to help',
      reason_tl: 'Mabilis na access sa tulong',
      estimated_cost: 0,
      urgency: 'MEDIUM'
    },
    {
      rank: 13,
      category: 'Home Safety',
      task: 'Learn how to shut off utilities (water, gas, electric)',
      task_tl: 'Alamin kung paano patayin ang mga linya (tubig, gas, kuryente)',
      reason: 'Prevents secondary hazards',
      reason_tl: 'Pinipigilan ang karagdagang panganib',
      estimated_cost: 0,
      urgency: 'MEDIUM'
    },
    {
      rank: 14,
      category: 'Medical',
      task: 'Complete first aid training course',
      task_tl: 'Kumpletuhin ang first aid training course',
      reason: 'Be prepared to help others',
      reason_tl: 'Maging handa na tumulong sa iba',
      estimated_cost: 1000,
      urgency: 'MEDIUM'
    },
    {
      rank: 15,
      category: 'Financial',
      task: 'Review and update insurance coverage',
      task_tl: 'Suriin at i-update ang coverage ng insurance',
      reason: 'Financial protection for property and health',
      reason_tl: 'Proteksyong pinansyal para sa ari-arian at kalusugan',
      estimated_cost: 0,
      urgency: 'MEDIUM'
    }
  ]
  
  try {
    await saveChecklistToDatabase(userId, genericChecklist)
    return genericChecklist
  } catch (error) {
    console.error('Error saving fallback checklist:', error)
    return genericChecklist
  }
}