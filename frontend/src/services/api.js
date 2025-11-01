// Read API URL from runtime config (injected by entrypoint.sh) or fallback to build-time env var
// Log for debugging
const getApiUrl = () => {
  const runtimeUrl = window.__APP_CONFIG__?.API_URL
  const buildTimeUrl = import.meta.env.VITE_API_URL
  const fallbackUrl = 'http://localhost:8080'
  
  const apiUrl = runtimeUrl || buildTimeUrl || fallbackUrl
  
  // Log for debugging (always - helps debug production issues)
  console.log('API URL config:', {
    runtime: runtimeUrl,
    buildTime: buildTimeUrl,
    final: apiUrl,
    hasWindowConfig: !!window.__APP_CONFIG__
  })
  
  return apiUrl
}

const API_BASE_URL = getApiUrl()

export const api = {
  async submitScan(serviceName, region, projectId) {
    const response = await fetch(`${API_BASE_URL}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_name: serviceName,
        region: region || undefined,
        project_id: projectId || undefined,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to submit scan')
    }

    return response.json()
  },

  async listJobs(limit = 50) {
    try {
      const url = `${API_BASE_URL}/jobs?limit=${limit}`
      console.log('Fetching jobs from:', url)
      const response = await fetch(url)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
        console.error('Failed to list jobs:', error, 'URL:', url)
        throw new Error(error.detail || 'Failed to list jobs')
      }

      return response.json()
    } catch (err) {
      console.error('Error in listJobs:', err, 'API_BASE_URL:', API_BASE_URL)
      throw err
    }
  },

  async getFindings(jobId, severity = '') {
    const url = new URL(`${API_BASE_URL}/findings/${jobId}`)
    if (severity) {
      url.searchParams.append('severity', severity)
    }

    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to get findings')
    }

    return response.json()
  },

  async explainFinding(findingId) {
    const response = await fetch(`${API_BASE_URL}/explain/${findingId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to get explanation')
    }

    return response.json()
  },

  async proposeFixes(jobId, findingIds = null) {
    const body = findingIds ? { job_id: jobId, findings_ids: findingIds } : null

    const response = await fetch(`${API_BASE_URL}/propose/${jobId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to propose fixes')
    }

    return response.json()
  },

  async getSummary(jobId) {
    const response = await fetch(`${API_BASE_URL}/summary/${jobId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to get summary')
    }

    return response.json()
  },
}
