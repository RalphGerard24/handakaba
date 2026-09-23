/**
 * Generate comprehensive system prompt for Gemini AI
 * Covers all 5 disaster types + Philippine context
 */
export function buildChecklistPrompt(userProfile, riskScores) {
  // Extract risk levels
  const risks = {
    flood: riskScores.flood_risk || 'NONE',
    earthquake: riskScores.earthquake_risk || 'NONE',
    typhoon: riskScores.typhoon_risk || 'NONE',
    landslide: riskScores.landslide_risk || 'NONE',
    heat: riskScores.heat_risk || 'NONE'
  }
  
  // Identify HIGH and MEDIUM risks to prioritize
  const highRisks = Object.entries(risks)
    .filter(([_, level]) => level === 'HIGH')
    .map(([disaster]) => disaster)
  
  const mediumRisks = Object.entries(risks)
    .filter(([_, level]) => level === 'MEDIUM')
    .map(([disaster]) => disaster)
  
  const prompt = `You are a disaster preparedness expert specializing in Filipino households.

**USER PROFILE:**
- Location: ${userProfile.city}, ${userProfile.district}, ${userProfile.barangay}
- Housing Type: ${userProfile.housing_type}, Floor Level: ${userProfile.floor_level}
- Household Size: ${userProfile.household_size} people
- Children: ${userProfile.has_children ? 'Yes' : 'No'}
- Elderly: ${userProfile.has_elderly ? 'Yes' : 'No'}
- PWD: ${userProfile.has_pwd ? 'Yes' : 'No'}
- Pets: ${userProfile.has_pets ? 'Yes' : 'No'}
- Vehicle: ${userProfile.has_vehicle ? 'Yes' : 'No'}
- Medical Dependencies: ${userProfile.medical_dependencies || 'None'}

**DISASTER RISK ASSESSMENT:**
- Flood Risk: ${risks.flood}
- Earthquake Risk: ${risks.earthquake}
- Typhoon/Storm Surge Risk: ${risks.typhoon}
- Landslide Risk: ${risks.landslide}
- Extreme Heat Risk: ${risks.heat}
- Overall Risk Score: ${riskScores.overall_score}/100

**PRIORITY RISKS TO ADDRESS:**
${highRisks.length > 0 ? `HIGH priority: ${highRisks.join(', ')}` : ''}
${mediumRisks.length > 0 ? `MEDIUM priority: ${mediumRisks.join(', ')}` : ''}

**YOUR TASK:**
Generate a personalized disaster preparedness checklist with EXACTLY 15 items.

**REQUIREMENTS:**
1. **Prioritize HIGH risks first**, then MEDIUM risks, then general preparedness
2. **Account for household constraints:**
   - If no vehicle → recommend public transport evacuation options, tricycle/jeepney routes
   - If elderly/PWD → include mobility aids, medical supplies, accessible evacuation
   - If young children → baby supplies, formula, diapers
   - If pets → pet carriers, food, veterinary records
   - If medical dependencies → backup medications, medical equipment power backup

3. **Use Philippine context:**
   - Costs in Philippine Pesos (₱)
   - Local resources: barangay hall, LGU, DSWD, NDRRMC, Red Cross
   - Local stores: SM, Puregold, Mercury Drug, National Bookstore
   - Emergency numbers: 911, barangay hotline
   - Filipino terms where appropriate

4. **Categories to use:**
   - Emergency Supplies (food, water, first aid)
   - Evacuation Planning (routes, go-bags, meeting points)
   - Home Safety (structural, utilities, valuables)
   - Communication (contacts, radios, social media)
   - Medical (medicines, medical records, prescriptions)
   - Financial (cash, documents, insurance)
   - Documentation (IDs, property papers, photos)

5. **Urgency levels:**
   - CRITICAL: Do immediately (within 24 hours) - for HIGH risks
   - HIGH: Do this week - for MEDIUM risks or essential preparedness
   - MEDIUM: Do this month - for general preparedness

6. **Cost estimates:**
   - Be realistic for Philippine market
   - Ranges: ₱100-₱500 (small), ₱500-₱2000 (medium), ₱2000-₱5000 (large)
   - Suggest affordable alternatives when possible

7. **Task descriptions:**
   - Be specific and actionable
   - Include WHERE to buy/do (e.g., "Buy at Mercury Drug or Watsons")
   - Include WHAT exactly (e.g., "3-day supply of canned goods, rice, instant noodles")

8. **Reasoning:**
   - Explain WHY this task matters for THEIR specific risks
   - Connect to their HIGH/MEDIUM risks explicitly
   - Make it personal and urgent

**OUTPUT FORMAT:**
Return ONLY a valid JSON object (no markdown, no explanations, no backticks):

{
  "items": [
    {
      "rank": 1,
      "category": "Emergency Supplies",
      "task": "Specific, actionable task description",
      "task_tl": "Accurate Tagalog translation of the task",
      "reason": "Why this matters for their specific situation and risks",
      "reason_tl": "Accurate Tagalog translation of the reason",
      "estimated_cost": 2500,
      "urgency": "CRITICAL"
    },
    ... (exactly 15 items total, ranks 1-15)
  ]
}

**CRITICAL:**
- Must have EXACTLY 15 items
- Ranks must be 1-15 (no duplicates)
- All costs in Philippine Pesos
- Tasks must be specific to their risks and household
- If HIGH flood risk → prioritize flood items (evacuation routes, waterproofing, go-bags)
- If MEDIUM heat risk → include cooling, hydration, electric fan backup
- NO generic advice - make it personal and actionable

Generate the checklist now:`

  return prompt
}

/**
 * Validate Gemini API response
 */
export function validateChecklistResponse(response) {
  const errors = []
  
  // Check if response exists
  if (!response || !response.items) {
    errors.push('Response missing items array')
    return { isValid: false, errors }
  }
  
  // Check exactly 15 items
  if (response.items.length !== 15) {
    errors.push(`Expected 15 items, got ${response.items.length}`)
  }
  
  // Validate each item
  const requiredFields = ['rank', 'category', 'task', 'task_tl', 'reason', 'reason_tl', 'estimated_cost', 'urgency']
  const validCategories = [
    'Emergency Supplies',
    'Evacuation Planning',
    'Home Safety',
    'Communication',
    'Medical',
    'Financial',
    'Documentation'
  ]
  const validUrgencies = ['CRITICAL', 'HIGH', 'MEDIUM']
  
  const ranks = new Set()
  
  response.items.forEach((item, index) => {
    // Check required fields
    requiredFields.forEach(field => {
      if (!(field in item)) {
        errors.push(`Item ${index + 1}: missing field '${field}'`)
      }
    })
    
    // Check rank is 1-15
    if (item.rank < 1 || item.rank > 15) {
      errors.push(`Item ${index + 1}: rank must be 1-15, got ${item.rank}`)
    }
    
    // Check for duplicate ranks
    if (ranks.has(item.rank)) {
      errors.push(`Duplicate rank ${item.rank}`)
    }
    ranks.add(item.rank)
    
    // Check valid category
    if (!validCategories.includes(item.category)) {
      errors.push(`Item ${index + 1}: invalid category '${item.category}'`)
    }
    
    // Check valid urgency
    if (!validUrgencies.includes(item.urgency)) {
      errors.push(`Item ${index + 1}: invalid urgency '${item.urgency}'`)
    }
    
    // Check cost is positive number
    if (typeof item.estimated_cost !== 'number' || item.estimated_cost < 0) {
      errors.push(`Item ${index + 1}: estimated_cost must be positive number`)
    }
    
    // Check strings are not empty
    if (!item.task || item.task.trim() === '') {
      errors.push(`Item ${index + 1}: task is empty`)
    }
    if (!item.reason || item.reason.trim() === '') {
      errors.push(`Item ${index + 1}: reason is empty`)
    }
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}