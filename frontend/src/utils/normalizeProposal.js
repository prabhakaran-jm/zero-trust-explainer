/**
 * Normalize AI proposal data to ensure consistent structure
 * @param {any} proposals - Raw proposals from API
 * @returns {object} Normalized proposal structure
 */
export function normalizeProposal(proposals) {
  if (!proposals) {
    return null
  }

  // If it's already a string, try to parse it
  if (typeof proposals === 'string') {
    try {
      // Remove common prefixes like "json" or markdown code blocks
      let cleaned = proposals
        .replace(/^json\s*/i, '')
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/g, '')
        .trim()
      
      // Try to parse as JSON
      proposals = JSON.parse(cleaned)
    } catch (e) {
      // If parsing fails, return as raw text
      return {
        summary: { raw: proposals },
        implementationSteps: null,
        testingRecommendations: null,
        terraformCode: null,
        terraformCodeBlocks: null
      }
    }
  }

  // Ensure it's an object
  if (typeof proposals !== 'object' || proposals === null) {
    return {
      summary: { raw: String(proposals) },
      implementationSteps: null,
      testingRecommendations: null,
      terraformCode: null,
      terraformCodeBlocks: null
    }
  }

  const normalized = {
    summary: null,
    implementationSteps: null,
    testingRecommendations: null,
    terraformCode: null,
    terraformCodeBlocks: null
  }

  // Normalize summary/ai_proposal
  if (proposals.ai_proposal || proposals.summary) {
    const summaryData = proposals.ai_proposal || proposals.summary
    
    if (typeof summaryData === 'string') {
      // Try multiple strategies to parse JSON and extract structured data
      let parsed = null
      
      // Strategy 1: Remove common prefixes and markdown code blocks
      let cleaned = summaryData
        .replace(/^json\s*/i, '')  // Remove "json" prefix
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/g, '')
        .replace(/^```/g, '')
        .trim()
      
      // Strategy 2: Try to find JSON object in string (handle cases like "json { ... }")
      // Use a more robust regex that finds the outermost JSON object
      let jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        // Try to match balanced braces more accurately
        let braceCount = 0
        let startIdx = -1
        for (let i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '{') {
            if (startIdx === -1) startIdx = i
            braceCount++
          } else if (cleaned[i] === '}') {
            braceCount--
            if (braceCount === 0 && startIdx !== -1) {
              jsonMatch = cleaned.substring(startIdx, i + 1)
              break
            }
          }
        }
        if (typeof jsonMatch === 'string') {
          cleaned = jsonMatch
        } else if (jsonMatch && jsonMatch[0]) {
          cleaned = jsonMatch[0]
        }
      }
      
      // Try to parse
      try {
        parsed = JSON.parse(cleaned)
      } catch (e1) {
        // Strategy 3: Try removing outer quotes if stringified
        try {
          if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            const unquoted = cleaned.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
            parsed = JSON.parse(unquoted)
          }
        } catch (e2) {
          // Strategy 4: Try to extract nested summary object
          if (cleaned.includes('"summary"') && cleaned.includes('{')) {
            try {
              // Try to extract the summary object using a more lenient approach
              const summaryStart = cleaned.indexOf('"summary"')
              if (summaryStart !== -1) {
                const afterSummary = cleaned.substring(summaryStart)
                const colonIdx = afterSummary.indexOf(':')
                if (colonIdx !== -1) {
                  const valueStart = afterSummary.substring(colonIdx + 1).search(/\S/)
                  if (valueStart !== -1) {
                    const actualStart = colonIdx + 1 + valueStart
                    let braceCount = 0
                    let foundStart = false
                    let objStart = -1
                    let objEnd = -1
                    
                    for (let i = actualStart; i < afterSummary.length; i++) {
                      if (afterSummary[i] === '{') {
                        if (!foundStart) {
                          objStart = i
                          foundStart = true
                        }
                        braceCount++
                      } else if (afterSummary[i] === '}') {
                        braceCount--
                        if (braceCount === 0 && objStart !== -1) {
                          objEnd = i + 1
                          break
                        }
                      }
                    }
                    
                    if (objStart !== -1 && objEnd !== -1) {
                      const summaryStr = afterSummary.substring(objStart, objEnd)
                      parsed = JSON.parse(summaryStr)
                    }
                  }
                }
              }
            } catch (e3) {
              // If all parsing fails, check if it contains structured content
              if (cleaned.includes('"issues"') || cleaned.includes('"description"')) {
                // Looks like JSON structure but unparseable - mark for special handling
                normalized.summary = { raw: summaryData, needsFormatting: true }
                return normalized
              }
            }
          }
          
          // Last resort: treat as raw text but try to extract meaningful content
          if (cleaned.includes('"summary"') || cleaned.includes('"issues"')) {
            normalized.summary = { raw: summaryData, needsFormatting: true }
          } else {
            normalized.summary = { raw: summaryData }
          }
          return normalized
        }
      }
      
      if (parsed && typeof parsed === 'object') {
        // If parsed object has a 'summary' key, use that
        if (parsed.summary && typeof parsed.summary === 'object') {
          normalized.summary = parsed.summary
        } else {
          normalized.summary = parsed
        }
      } else if (parsed) {
        // Parsed to non-object (string, number, etc.)
        normalized.summary = { raw: String(parsed) }
      }
    } else if (typeof summaryData === 'object') {
      // If object has a nested 'summary' key, use that
      if (summaryData.summary && typeof summaryData.summary === 'object') {
        normalized.summary = summaryData.summary
      } else {
        normalized.summary = summaryData
      }
    }
  }

  // Normalize implementation steps
  if (proposals.implementation_steps) {
    normalized.implementationSteps = normalizeArrayOrObject(proposals.implementation_steps)
  }

  // Normalize testing recommendations
  if (proposals.testing_recommendations) {
    normalized.testingRecommendations = normalizeArrayOrObject(proposals.testing_recommendations)
  }

  // Normalize Terraform code
  if (proposals.terraform_code) {
    if (typeof proposals.terraform_code === 'string') {
      try {
        let cleaned = proposals.terraform_code
          .replace(/^json\s*/i, '')
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/g, '')
          .trim()
        const parsed = JSON.parse(cleaned)
        if (typeof parsed === 'object') {
          normalized.terraformCodeBlocks = parsed
        } else {
          normalized.terraformCode = proposals.terraform_code
        }
      } catch {
        normalized.terraformCode = proposals.terraform_code
      }
    } else if (typeof proposals.terraform_code === 'object') {
      normalized.terraformCodeBlocks = proposals.terraform_code
    }
  }

  return normalized
}

/**
 * Normalize an array or object to a consistent format
 * @param {any} data - Array or object to normalize
 * @returns {array|object} Normalized structure
 */
function normalizeArrayOrObject(data) {
  if (Array.isArray(data)) {
    // Convert array items to strings
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        // Try common text fields first
        return item.text || item.description || item.step || item.title || 
               item.recommendation || item.name || JSON.stringify(item, null, 2)
      }
      return String(item)
    })
  } else if (typeof data === 'object' && data !== null) {
    // Keep as object structure but normalize nested arrays/objects
    const normalized = {}
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        normalized[key] = normalizeArrayOrObject(value)
      } else if (typeof value === 'object' && value !== null) {
        normalized[key] = normalizeArrayOrObject(value)
      } else {
        normalized[key] = String(value)
      }
    }
    return normalized
  } else {
    return [String(data)]
  }
}

