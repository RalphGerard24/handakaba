/**
 * Translate text to Tagalog using MyMemory Translated API (free, no key needed)
 */
export const translateToTagalog = async (text) => {
  if (!text) return ''
  
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|tl`
    )
    
    const data = await response.json()
    
    if (data.responseStatus === 200) {
      return data.responseData.translatedText
    }
    
    // Fallback if translation fails
    return text
    
  } catch (error) {
    console.error('Translation error:', error)
    return text // Return original if error
  }
}

/**
 * Translate multiple items (batch)
 */
export const translateChecklist = async (items) => {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      task_tl: await translateToTagalog(item.task),
      reason_tl: await translateToTagalog(item.reason)
    }))
  )
}
