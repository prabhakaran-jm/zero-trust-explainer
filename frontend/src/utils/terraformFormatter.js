/**
 * Format Terraform code with proper indentation
 * @param {string} code - Raw Terraform code
 * @returns {string} Formatted Terraform code
 */
export function formatTerraformCode(code) {
  if (!code || typeof code !== 'string') {
    return code
  }

  // Remove any leading/trailing whitespace
  code = code.trim()
  
  // Handle escaped newlines (from JSON strings)
  if (code.includes('\\n')) {
    code = code.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"')
  }
  
  // If the code is all on one line (no newlines), try to split it intelligently
  if (!code.includes('\n') && code.length > 50) {
    // Split on common Terraform patterns
    code = code
      // Add newline before resource/data blocks (but not if already at start)
      .replace(/\bresource\s+("|\w+)/g, '\nresource $1')
      .replace(/\bdata\s+("|\w+)/g, '\ndata $1')
      .replace(/\bvariable\s+("|\w+)/g, '\nvariable $1')
      .replace(/\boutput\s+("|\w+)/g, '\noutput $1')
      .replace(/\blocals\s*\{/g, '\nlocals {')
      .replace(/\bmodule\s+("|\w+)/g, '\nmodule $1')
      // Add newline after closing braces (unless followed by comma or closing paren)
      .replace(/\}\s*(?![,\)\]\s*[,\)\]])/g, '}\n')
      // Add newline before opening braces (but preserve spacing)
      .replace(/([^"\n])\s*\{/g, '$1 {\n')
      // Add newline after attribute assignments if they're complex
      .replace(/(\w+)\s*=\s*([^"{]+?)(\s*[,\]\}])/g, (match, attr, value, ending) => {
        // Don't split if value is short and simple
        if (value.length < 40 && !value.includes('(') && !value.includes('[')) {
          return match
        }
        return `${attr} = ${value}\n${ending}`
      })
      // Add newline before depends_on, providers, etc. (block-level attributes)
      .replace(/\b(depends_on|providers|lifecycle|connection|provisioner|vpc_access|env)\s*=/g, '\n$1 =')
      // Add newline before nested blocks
      .replace(/\b(template|containers|resources|scaling|traffic|env|value_source|secret_key_ref)\s*\{/g, '\n$1 {')
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '') // Remove leading newlines
      .trim()
  }
  
  // Split into lines
  const lines = code.split('\n')
  const formattedLines = []
  let indentLevel = 0
  const indentSize = 2
  let inMultiLineString = false
  let stringDelimiter = null

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines but preserve them
    if (trimmed === '') {
      formattedLines.push('')
      continue
    }

    // Track multi-line strings (heredoc or triple quotes)
    const openHeredoc = (trimmed.match(/<<-?\s*(\w+)/g) || []).length
    const closeHeredoc = (trimmed.match(/(\w+)\s*$/g) || []).length > 0 && inMultiLineString
    
    if (openHeredoc) {
      inMultiLineString = true
    }
    if (closeHeredoc) {
      inMultiLineString = false
    }

    // Decrease indent before closing braces (but not if in string)
    if (!inMultiLineString && (trimmed === '}' || trimmed.startsWith('}'))) {
      indentLevel = Math.max(0, indentLevel - 1)
    }

    // Add proper indentation
    const indent = ' '.repeat(indentLevel * indentSize)
    formattedLines.push(indent + trimmed)

    // Increase indent after opening braces (but not if it's on the same line as closing)
    if (!inMultiLineString && trimmed.includes('{') && !trimmed.includes('}')) {
      indentLevel++
    }
    // Handle case where opening and closing are on same line: `resource "x" "y" {}`
    // Check if there's an opening brace after this
    else if (!inMultiLineString && trimmed.includes('{') && trimmed.includes('}')) {
      // Count braces to determine if we should indent
      const openCount = (trimmed.match(/\{/g) || []).length
      const closeCount = (trimmed.match(/\}/g) || []).length
      if (openCount > closeCount) {
        indentLevel++
      }
    }
  }

  // Join and clean up multiple blank lines
  let result = formattedLines.join('\n')
  // Replace 3+ consecutive empty lines with 2
  result = result.replace(/\n{3,}/g, '\n\n')
  
  return result
}
