import { useState, useEffect, useCallback } from 'react'
import './App.css'
import ScanForm from './components/ScanForm'
import JobCard from './components/JobCard'
import FindingsList from './components/FindingsList'
import HealthChip from './components/HealthChip'
import Spinner from './components/Spinner'
import QuickLinks from './components/QuickLinks'
import { api } from './services/api'
import { notify } from './utils/notify'
import { copyToClipboard, copyText } from './utils/clipboard'
import { formatTerraformCode } from './utils/terraformFormatter'
import { normalizeProposal } from './utils/normalizeProposal'
import usePolling from './hooks/usePolling'

function App() {
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [findings, setFindings] = useState([])
  const [severityFilter, setSeverityFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [currentExplanation, setCurrentExplanation] = useState(null)
  const [showSummary, setShowSummary] = useState(false)
  const [currentSummary, setCurrentSummary] = useState(null)
  const [parsedSummaryData, setParsedSummaryData] = useState(null)
  const [summaryError, setSummaryError] = useState(null)
  const [showProposeModal, setShowProposeModal] = useState(false)
  const [proposeContent, setProposeContent] = useState(null)
  const [proposeJobId, setProposeJobId] = useState(null) // Track job ID for retry
  const [aiLoading, setAiLoading] = useState({ explain: null, propose: null, summary: null })
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [findingsError, setFindingsError] = useState(null)

  useEffect(() => {
    loadJobs()
    checkAIStatus()
  }, [])

  // Effect to safely parse summary data when it changes
  useEffect(() => {
    if (!currentSummary) {
      setParsedSummaryData(null)
      return
    }

    try {
      console.log("Attempting to parse summary data:", currentSummary)
      let summaryData
      if (typeof currentSummary.summary === 'string') {
        summaryData = JSON.parse(currentSummary.summary)
      } else {
        summaryData = currentSummary.summary
      }

      if (typeof summaryData !== 'object' || summaryData === null) {
        throw new Error("Parsed summary is not a valid object.")
      }
      
      // Helper function to safely convert any value to string
      const safeToString = (value, fallback = '') => {
        if (value === null || value === undefined) return fallback
        if (typeof value === 'string') return value
        if (typeof value === 'object') {
          // Try to extract meaningful string from object
          return value.text || value.description || value.summary || JSON.stringify(value)
        }
        return String(value)
      }
      
      // Normalize string fields to ensure they're always strings
      summaryData.executive_summary = safeToString(summaryData.executive_summary, 'No summary available.')
      summaryData.risk_overview = safeToString(summaryData.risk_overview, 'Not available.')
      summaryData.business_impact = safeToString(summaryData.business_impact, 'Not available.')
      summaryData.compliance_status = safeToString(summaryData.compliance_status, 'Not available.')
      
      // Preserve remediation_roadmap as-is if it's an object/JSON (for nice formatting)
      // Only convert to string if it's not an object
      if (summaryData.remediation_roadmap) {
        if (typeof summaryData.remediation_roadmap === 'object' && summaryData.remediation_roadmap !== null) {
          // Keep as object for structured formatting
          // Do nothing - keep the object
        } else if (typeof summaryData.remediation_roadmap === 'string') {
          // Try to parse JSON string, but keep original if parsing fails
          try {
            if (summaryData.remediation_roadmap.trim().startsWith('{') || summaryData.remediation_roadmap.trim().startsWith('[')) {
              const parsed = JSON.parse(summaryData.remediation_roadmap)
              if (typeof parsed === 'object' && parsed !== null) {
                summaryData.remediation_roadmap = parsed
              }
            }
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
      }
      
      // Normalize arrays to ensure they contain strings, not objects
      if (summaryData.top_concerns && Array.isArray(summaryData.top_concerns)) {
        summaryData.top_concerns = summaryData.top_concerns.map(item => {
          if (typeof item === 'string') return item
          if (typeof item === 'object' && item !== null) {
            // Convert object to string representation
            return item.issue || item.description || item.title || JSON.stringify(item)
          }
          return String(item)
        })
      }
      
      if (summaryData.recommendations && Array.isArray(summaryData.recommendations)) {
        summaryData.recommendations = summaryData.recommendations.map(item => {
          if (typeof item === 'string') return item
          if (typeof item === 'object' && item !== null) {
            // Convert object to string representation
            return item.recommendation || item.suggestion || item.text || JSON.stringify(item)
          }
          return String(item)
        })
      }
      
      console.log("Successfully parsed summary data:", summaryData)
      setParsedSummaryData(summaryData)
      setSummaryError(null) // Clear previous errors
    } catch (error) {
      console.error("Failed to parse summary data:", error)
      setSummaryError("Failed to display summary. The data format is invalid.")
      setParsedSummaryData(null) // Clear old data
    }
  }, [currentSummary])

  // Auto-refresh polling after scan
  const fetchJobs = useCallback(async () => {
    console.log('[fetchJobs] Starting fetch at', new Date().toISOString())
    try {
      const data = await api.listJobs()
      console.log('[fetchJobs] Received', data.jobs?.length || 0, 'jobs from API')

      // Sort jobs by first_finding_at descending (newest first)
      // Jobs without findings (newly created) should appear at the top
      const sortedJobs = (data.jobs || []).sort((a, b) => {
        // If both have no findings, check created_at or job_id
        if (!a.first_finding_at && !b.first_finding_at) {
          // Newer jobs first based on job_id (which includes timestamp) or created_at
          const aCreated = a.created_at || a.job_id || ''
          const bCreated = b.created_at || b.job_id || ''
          return bCreated.localeCompare(aCreated)
        }
        // Jobs without findings go first
        if (!a.first_finding_at) return -1
        if (!b.first_finding_at) return 1
        return new Date(b.first_finding_at) - new Date(a.first_finding_at)
      })

      setJobs(sortedJobs)
      console.log('[fetchJobs] Updated state with', sortedJobs.length, 'sorted jobs')
    } catch (err) {
      console.error('[fetchJobs] Error:', err)
    }
  }, [])

  usePolling(fetchJobs, 3000, autoRefresh)
  
  // Debug logging for auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      console.log('[App] ✅ Auto-refresh ENABLED - polling every 3s for 2.5 minutes')
      console.log('[App] Current timestamp:', new Date().toISOString())
      console.log('[App] Note: BigQuery results can take up to 2 minutes to appear')
    } else {
      console.log('[App] ⛔ Auto-refresh DISABLED')
    }
  }, [autoRefresh])

  useEffect(() => {
    if (autoRefresh) {
      const durationMs = 150000 // 2.5 minutes (150 seconds)
      console.log('[App] Setting up auto-stop timer for', durationMs / 1000, 'seconds')
      const timer = setTimeout(() => {
        console.log('[App] Polling duration elapsed - stopping auto-refresh')
        setAutoRefresh(false)
      }, durationMs)
      return () => {
        console.log('[App] Cleaning up auto-stop timer')
        clearTimeout(timer)
      }
    }
  }, [autoRefresh])

  const checkAIStatus = async () => {
    try {
      const apiUrl = (window.__APP_CONFIG__?.API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:8080'
      const response = await fetch(`${apiUrl}/`)
      const data = await response.json()
      setAiStatus(data.ai_studio)
    } catch (err) {
      console.error('Error checking AI status:', err)
    }
  }

  useEffect(() => {
    if (selectedJobId) {
      loadFindings(selectedJobId, severityFilter)
    }
  }, [selectedJobId, severityFilter])

  const loadJobs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.listJobs()
      // Sort jobs by first_finding_at descending (newest first)
      // Jobs without findings (newly created) should appear at the top
      const sortedJobs = (data.jobs || []).sort((a, b) => {
        // If both have no findings, check created_at or job_id
        if (!a.first_finding_at && !b.first_finding_at) {
          // Newer jobs first based on job_id (which includes timestamp) or created_at
          const aCreated = a.created_at || a.job_id || ''
          const bCreated = b.created_at || b.job_id || ''
          return bCreated.localeCompare(aCreated)
        }
        // Jobs without findings go first
        if (!a.first_finding_at) return -1
        if (!b.first_finding_at) return 1
        return new Date(b.first_finding_at) - new Date(a.first_finding_at)
      })
      setJobs(sortedJobs)
    } catch (err) {
      setError('Failed to load jobs: ' + err.message)
      console.error('Error loading jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadFindings = async (jobId, severity = '') => {
    try {
      setLoading(true)
      setError(null)
      setFindingsError(null)
      const data = await api.getFindings(jobId, severity)
      setFindings(data.findings || [])
    } catch (err) {
      const errorMsg = 'Failed to load findings: ' + err.message
      setFindingsError(errorMsg)
      setError(errorMsg)
      console.error('Error loading findings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleScanSubmit = async (serviceName, region, projectId) => {
    try {
      setLoading(true)
      setError(null)
      const result = await api.submitScan(serviceName, region, projectId)
      const jobId = result.job_id
      
      notify.ok(`Scan scheduled — job ${jobId.substring(0, 8)}...`)
      
      // Update URL hash for deep linking
      window.history.replaceState(null, '', '#jobs')
      
      // Scan submission is complete, stop loading spinner
      setLoading(false)

      console.log('[handleScanSubmit] Scan submitted successfully, job_id:', jobId)
      console.log('[handleScanSubmit] Enabling auto-refresh polling...')
      console.log('[handleScanSubmit] Will poll for 2.5 minutes (BigQuery results take up to 2 mins)')

      // Start auto-refresh polling for 2.5 minutes (polling every 3s)
      // BigQuery can take up to 2 minutes to show results, so we need longer polling
      // The usePolling hook will call fetchJobs immediately and then every 3s
      setAutoRefresh(true)
    } catch (err) {
      notify.err('Failed to schedule scan: ' + err.message)
      setError('Failed to submit scan: ' + err.message)
      console.error('Error submitting scan:', err)
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (selectedJobId) {
      loadFindings(selectedJobId, severityFilter)
    } else {
      loadJobs()
    }
  }

  const handleExplain = async (findingId) => {
    try {
      setAiLoading(prev => ({ ...prev, explain: findingId }))
      setError(null)
      const explanation = await api.explainFinding(findingId)
      setCurrentExplanation(explanation)
      setShowExplanation(true)
    } catch (err) {
      notify.err('Failed to get explanation: ' + err.message)
      setError('Failed to get explanation: ' + err.message)
      console.error('Error getting explanation:', err)
    } finally {
      setAiLoading(prev => ({ ...prev, explain: null }))
    }
  }

  const handleSummary = async (jobId) => {
    try {
      setAiLoading(prev => ({ ...prev, summary: jobId }))
      setError(null)
      // Reset states before fetching new summary
      setCurrentSummary(null)
      setParsedSummaryData(null)
      setSummaryError(null)
      setShowSummary(true) // Show modal with loading state immediately

      const summary = await api.getSummary(jobId)
      setCurrentSummary(summary) // This will trigger the useEffect to parse the data
    } catch (err) {
      notify.err('Failed to get summary: ' + err.message)
      setError('Failed to get summary: ' + err.message)
      console.error('Error getting summary:', err)
      setSummaryError(`Failed to fetch AI summary: ${err.message}`)
    } finally {
      setAiLoading(prev => ({ ...prev, summary: null }))
    }
  }

  const handlePropose = async (jobId) => {
    try {
      setAiLoading(prev => ({ ...prev, propose: jobId }))
      setError(null)
      const result = await api.proposeFixes(jobId)
      
      notify.ok('Propose job triggered successfully!')
      
      // Prepare content for modal display
      let content = {
        success: true,
        message: `✅ Propose job triggered successfully!`,
        aiPowered: result.ai_powered,
        aiModel: result.ai_model,
        reportUrl: result.report_url,
        summary: null,
        implementationSteps: null,
        testingRecommendations: null,
        terraformCode: null,
        policyCheck: result.policy_check || result.preservation_check || null // Policy troubleshooter result
      }
      
      if (result.ai_powered && result.ai_proposals) {
        // Normalize the proposals to ensure consistent structure
        const normalized = normalizeProposal(result.ai_proposals)
        
        // Check if this looks like a fallback/minimal response from backend
        const isFallbackResponse = (proposals) => {
          if (!proposals || typeof proposals !== 'object') return false
          
          // Check for common fallback patterns
          const hasFallbackTerraform = proposals.terraform_code === "# Generated fixes - see summary above" ||
                                      proposals.terraform_code === "# AI-generated fixes" ||
                                      proposals.terraform_code === "# Manual review required"
          
          const hasFallbackSteps = Array.isArray(proposals.implementation_steps) &&
                                   proposals.implementation_steps.length === 1 &&
                                   (proposals.implementation_steps[0] === "Review the detailed summary" ||
                                    proposals.implementation_steps[0] === "Manual review required" ||
                                    proposals.implementation_steps[0] === "Review findings manually")
          
          const hasFallbackTesting = Array.isArray(proposals.testing_recommendations) &&
                                     proposals.testing_recommendations.length === 1 &&
                                     (proposals.testing_recommendations[0] === "Test all changes in development first" ||
                                      proposals.testing_recommendations[0] === "Test thoroughly" ||
                                      proposals.testing_recommendations[0] === "Test manually")
          
          // Also check if summary is raw JSON string (not parsed)
          const hasRawJsonSummary = proposals.summary && typeof proposals.summary === 'string' && 
                                    (proposals.summary.trim().startsWith('{') || proposals.summary.trim().startsWith('"'))
          
          // Check if ai_proposal exists but no structured data
          const hasOnlyRawAiProposal = proposals.ai_proposal && typeof proposals.ai_proposal === 'string' &&
                                       !proposals.implementation_steps && !proposals.terraform_code && !proposals.testing_recommendations
          
          return (hasFallbackTerraform && hasFallbackSteps && hasFallbackTesting) || hasRawJsonSummary || hasOnlyRawAiProposal
        }
        
        const isFallback = isFallbackResponse(result.ai_proposals)
        
        if (isFallback) {
          // This is a fallback response - likely AI response couldn't be parsed
          console.warn('Received fallback response from backend - AI response may have been unparseable')
          
          // Try to extract any useful content from ai_proposal if it exists
          if (result.ai_proposals.ai_proposal && typeof result.ai_proposals.ai_proposal === 'string') {
            content.summary = { 
              raw: result.ai_proposals.ai_proposal,
              isFallback: true,
              message: 'AI response was partially parsed. The analysis may still be processing in the background.'
            }
          } else if (normalized && normalized.summary) {
            content.summary = normalized.summary
            if (content.summary.raw) {
              content.summary.isFallback = true
              content.summary.message = 'AI response format was unexpected. The analysis may still be processing.'
            }
          } else {
            content.summary = { 
              raw: 'The AI response could not be parsed. The analysis may still be processing in the background. Please click "AI Propose" again to retry.',
              isFallback: true,
              message: 'AI processing may not be complete yet.'
            }
          }
          
          if (normalized) {
            if (normalized.implementationSteps) {
              content.implementationSteps = normalized.implementationSteps
            }
            if (normalized.testingRecommendations) {
              content.testingRecommendations = normalized.testingRecommendations
            }
            if (normalized.terraformCode) {
              content.terraformCode = normalized.terraformCode
            }
            if (normalized.terraformCodeBlocks) {
              content.terraformCodeBlocks = normalized.terraformCodeBlocks
            }
          }
        } else if (normalized) {
          if (normalized.summary) {
            content.summary = normalized.summary
          }
          if (normalized.implementationSteps) {
            content.implementationSteps = normalized.implementationSteps
          }
          if (normalized.testingRecommendations) {
            content.testingRecommendations = normalized.testingRecommendations
          }
          if (normalized.terraformCode) {
            content.terraformCode = normalized.terraformCode
          }
          if (normalized.terraformCodeBlocks) {
            content.terraformCodeBlocks = normalized.terraformCodeBlocks
          }
        } else {
          content.summary = { raw: String(result.ai_proposals) }
        }
      }
      
      setProposeContent(content)
      setProposeJobId(jobId) // Store job ID for retry
      setShowProposeModal(true)
    } catch (err) {
      notify.err('Failed to trigger propose: ' + err.message)
      setError('Failed to trigger propose: ' + err.message)
      console.error('Error triggering propose:', err)
    } finally {
      setAiLoading(prev => ({ ...prev, propose: null }))
    }
  }

  const handleCopyJobId = async (jobId) => {
    const success = await copyToClipboard(jobId)
    if (success) {
      notify.ok('Job ID copied to clipboard')
    } else {
      notify.err('Failed to copy Job ID')
    }
  }

  const handleCopyLink = async (url) => {
    const success = await copyToClipboard(url)
    if (success) {
      notify.ok('Link copied to clipboard')
    } else {
      notify.err('Failed to copy link')
    }
  }


  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div>
            <h1>🛡️ Zero-Trust Explainer</h1>
            <p>Human-readable IAM diffs for Cloud Run</p>
          </div>
          <div className="header-right">
            <div className="header-right-content">
              <QuickLinks />
              <HealthChip apiBase={(window.__APP_CONFIG__?.API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:8080'} />
            </div>
          </div>
        </div>
        {aiStatus && (
          <div className="ai-status">
            {aiStatus.enabled ? (
              <span className="ai-enabled">
                🤖 AI Studio Enabled ({aiStatus.model})
              </span>
            ) : (
              <span className="ai-disabled">
                ⚠️ AI Studio Disabled
              </span>
            )}
          </div>
        )}
      </header>

      <main className="App-main">
        <section className="scan-section">
          <h2>Submit Scan</h2>
          <ScanForm onSubmit={handleScanSubmit} loading={loading} />
        </section>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <section className="jobs-section">
          <div className="section-header">
            <h2>Recent Scan Jobs</h2>
            <button onClick={handleRefresh} disabled={loading} className="refresh-btn">
              {loading ? (
                <>
                  <Spinner size="14px" /> Loading...
                </>
              ) : (
                '🔄 Refresh'
              )}
            </button>
          </div>
          
          <div className="jobs-grid">
            {jobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
                isSelected={selectedJobId === job.job_id}
                onSelect={() => {
                  setSelectedJobId(job.job_id)
                  // Scroll to findings after state update
                  setTimeout(() => {
                    const el = document.getElementById(`findings-${job.job_id}`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }, 50)
                }}
                onSummary={handleSummary}
                onPropose={handlePropose}
                onCopyJobId={handleCopyJobId}
                aiLoading={aiLoading}
              />
            ))}
            {jobs.length === 0 && !loading && (
              <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                No scan jobs yet. Click <strong>Start Scan</strong>, then we'll refresh results.
              </div>
            )}
          </div>
        </section>

        {selectedJobId && (
          <section id={`findings-${selectedJobId}`} className="findings-section">
            <div className="section-header">
              <h2>Findings for Job {selectedJobId}</h2>
              <div className="filters">
                <label>
                  Severity Filter:
                  <select 
                    value={severityFilter} 
                    onChange={(e) => setSeverityFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>
            </div>
            
            <FindingsList 
              findings={findings} 
              onExplain={handleExplain}
              loading={loading}
              aiLoading={aiLoading}
              error={findingsError}
            />
          </section>
        )}
      </main>

      <footer className="App-footer">
        <p>Zero-Trust Explainer v1.0.0</p>
      </footer>

      {/* AI Explanation Modal */}
      {showExplanation && currentExplanation && (
        <div className="modal-overlay" onClick={() => setShowExplanation(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 Security Finding Explanation</h3>
              <button 
                className="close-btn"
                onClick={() => setShowExplanation(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="finding-info">
                <div className="finding-meta">
                  <span className={`severity-badge ${currentExplanation.severity}`}>
                    {currentExplanation.severity}
                  </span>
                  <span className="resource-type">{currentExplanation.resource_type}</span>
                  <span className="resource-name">{currentExplanation.resource_name}</span>
                </div>
                
                {/* AI-Powered Explanation Section */}
                {(currentExplanation.ai_explanation || currentExplanation.explanation) && (
                  <div className="ai-explanation-section">
                    <h4>🤖 AI-Powered Explanation</h4>
                    <p className="ai-explanation-text">{currentExplanation.ai_explanation || currentExplanation.explanation}</p>
                    
                    {currentExplanation.ai_powered && (
                      <div className="ai-badge">
                        <span>Powered by {currentExplanation.ai_model || 'AI'}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Blast Radius Analysis */}
                {currentExplanation.blast_radius && (
                  <div className="explanation-section blast-radius">
                    <h4>💥 Blast Radius Analysis</h4>
                    {typeof currentExplanation.blast_radius === 'string' ? (
                      <p>{currentExplanation.blast_radius}</p>
                    ) : (
                      <>
                        <p>{currentExplanation.blast_radius.description || 'See explanation above'}</p>
                        {currentExplanation.blast_radius.affected_resources && (
                          <div className="affected-resources">
                            <strong>Affected Resources:</strong>
                            <ul>
                              {Array.isArray(currentExplanation.blast_radius.affected_resources) ? (
                                currentExplanation.blast_radius.affected_resources.map((resource, index) => (
                                  <li key={index}>{resource}</li>
                                ))
                              ) : (
                                <li>{currentExplanation.blast_radius.affected_resources}</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                
                {/* Risk Assessment */}
                {currentExplanation.risk_assessment && (
                  <div className="explanation-section risk-assessment">
                    <h4>⚠️ Risk Assessment</h4>
                    <p>{currentExplanation.risk_assessment}</p>
                    
                    {currentExplanation.priority_score !== undefined && (
                      <div className="priority-info">
                        <strong>Priority Score:</strong> {currentExplanation.priority_score}/100
                      </div>
                    )}
                    
                    {currentExplanation.business_impact && (
                      <div className="business-impact">
                        <strong>Business Impact:</strong> {currentExplanation.business_impact}
                      </div>
                    )}
                    
                    {currentExplanation.remediation_urgency && (
                      <div className="remediation-urgency">
                        <strong>Remediation Urgency:</strong> {currentExplanation.remediation_urgency}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Attack Vector */}
                {currentExplanation.attack_vector && (
                  <div className="explanation-section attack-vector">
                    <h4>🎯 Attack Vector</h4>
                    <p>{currentExplanation.attack_vector}</p>
                  </div>
                )}
                
                {/* Compliance Impact */}
                {currentExplanation.compliance_impact && (
                  <div className="explanation-section compliance-impact">
                    <h4>📋 Compliance Impact</h4>
                    <p>{currentExplanation.compliance_impact}</p>
                  </div>
                )}
                
                {/* Recommendation */}
                {currentExplanation.recommendation && (
                  <div className="explanation-section recommendation">
                    <h4>💡 Recommendation</h4>
                    <p>{currentExplanation.recommendation}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {showSummary && (
        <div className="modal-overlay" onClick={() => setShowSummary(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                📊 Executive Summary
                {currentSummary?.ai_powered === false && (
                  <span className="ai-fallback-indicator" title="AI features are currently disabled. This is a rule-based summary."> (Fallback)</span>
                )}
              </h3>
              <button className="modal-close-btn" onClick={() => setShowSummary(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {aiLoading?.summary && !parsedSummaryData && <Spinner text="Generating AI Summary..." />}
              
              {summaryError && <div className="error-message">{summaryError}</div>}

              {parsedSummaryData && !summaryError && (
                <>
                  <div className="summary-section">
                    <h4>Executive Summary</h4>
                    <p>{parsedSummaryData.executive_summary ?? "No summary available."}</p>
                  </div>

                  <div className="summary-grid">
                    <div className="summary-card">
                      <h5>Risk Overview</h5>
                      <p>{parsedSummaryData.risk_overview ?? "Not available."}</p>
                    </div>
                    <div className="summary-card">
                      <h5>Business Impact</h5>
                      <p>{parsedSummaryData.business_impact ?? "Not available."}</p>
                    </div>
                    <div className="summary-card">
                      <h5>Compliance Status</h5>
                      <p>{parsedSummaryData.compliance_status ?? "Not available."}</p>
                    </div>
                  </div>

                  {parsedSummaryData.severity_counts && typeof parsedSummaryData.severity_counts === 'object' && Object.keys(parsedSummaryData.severity_counts).length > 0 && (
                    <div className="summary-section">
                      <h4>Findings Breakdown</h4>
                      <div className="severity-counts-grid">
                        {Object.entries(parsedSummaryData.severity_counts)
                          .filter(([severity, count]) => severity && (count !== null && count !== undefined))
                          .map(([severity, count]) => (
                            <div key={String(severity)} className={`severity-count-card severity-${String(severity).toLowerCase()}`}>
                              <span className="severity-count">{count}</span>
                              <span className="severity-label">{String(severity)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {parsedSummaryData.top_concerns?.length > 0 && (
                    <div className="summary-section">
                      <h4>Top Concerns</h4>
                      <ul>
                        {parsedSummaryData.top_concerns.map((concern, index) => {
                          // Ensure we always render a string, not an object
                          const displayText = typeof concern === 'string' 
                            ? concern 
                            : (typeof concern === 'object' && concern !== null
                              ? (concern.issue || concern.description || concern.title || JSON.stringify(concern))
                              : String(concern))
                          return <li key={index}>{displayText}</li>
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="summary-section">
                    <h4>Remediation Roadmap</h4>
                    {(() => {
                      const roadmap = parsedSummaryData.remediation_roadmap
                      if (!roadmap) {
                        return <p>No roadmap available.</p>
                      }
                      
                      // Try to parse JSON string if it's a string
                      let parsedRoadmap = roadmap
                      if (typeof roadmap === 'string') {
                        try {
                          // Check if it's JSON
                          if (roadmap.trim().startsWith('{') || roadmap.trim().startsWith('[')) {
                            parsedRoadmap = JSON.parse(roadmap)
                          }
                        } catch (e) {
                          // Not JSON, use as string
                          parsedRoadmap = roadmap
                        }
                      }
                      
                      // If it's an object with phases, format it nicely
                      if (typeof parsedRoadmap === 'object' && parsedRoadmap !== null) {
                        // Helper function to render a phase
                        const renderPhase = (phase, index) => {
                          // Extract phase name from phase.phase or phase.name or default to "Phase {index + 1}"
                          const phaseName = phase.phase || phase.name || `Phase ${index + 1}`
                          
                          // Determine priority from phase.priority or infer from phase name
                          let priority = phase.priority
                          if (!priority && phaseName) {
                            const nameLower = phaseName.toLowerCase()
                            if (nameLower.includes('immediate') || nameLower.includes('critical')) {
                              priority = 'IMMEDIATE'
                            } else if (nameLower.includes('short') || nameLower.includes('high')) {
                              priority = 'HIGH'
                            } else if (nameLower.includes('mid') || nameLower.includes('medium')) {
                              priority = 'MEDIUM'
                            } else if (nameLower.includes('long') || nameLower.includes('low')) {
                              priority = 'LOW'
                            }
                          }
                          
                          return (
                            <div key={index} className="remediation-roadmap-phase">
                              <h5>
                                {phaseName}
                                {priority && (
                                  <span className={`phase-priority ${priority.toLowerCase().replace('_', '-')}`}>
                                    {priority}
                                  </span>
                                )}
                              </h5>
                              {phase.actions && Array.isArray(phase.actions) && (
                                <ul>
                                  {phase.actions.map((action, actionIndex) => (
                                    <li key={actionIndex}>
                                      {typeof action === 'string' ? action : (action.description || action.text || JSON.stringify(action))}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {phase.description && (
                                <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                                  {typeof phase.description === 'string' ? phase.description : JSON.stringify(phase.description)}
                                </p>
                              )}
                            </div>
                          )
                        }
                        
                        // Check if it's directly an array of phases
                        if (Array.isArray(parsedRoadmap)) {
                          return (
                            <div className="remediation-roadmap-phases">
                              {parsedRoadmap.map(renderPhase)}
                            </div>
                          )
                        }
                        
                        // Check if it has phases array
                        if (parsedRoadmap.phases && Array.isArray(parsedRoadmap.phases)) {
                          return (
                            <div className="remediation-roadmap-phases">
                              {parsedRoadmap.phases.map(renderPhase)}
                            </div>
                          )
                        }
                        // If it's just an object, try to display it formatted
                        return (
                          <div className="remediation-roadmap">
                            {JSON.stringify(parsedRoadmap, null, 2)}
                          </div>
                        )
                      }
                      
                      // Otherwise, display as plain text
                      return <p className="remediation-roadmap">{parsedRoadmap}</p>
                    })()}
                  </div>

                  {parsedSummaryData.recommendations?.length > 0 && (
                    <div className="summary-section">
                      <h4>Strategic Recommendations</h4>
                      <ul>
                        {parsedSummaryData.recommendations.map((rec, index) => {
                          // Ensure we always render a string, not an object
                          const displayText = typeof rec === 'string' 
                            ? rec 
                            : (typeof rec === 'object' && rec !== null
                              ? (rec.recommendation || rec.suggestion || rec.text || JSON.stringify(rec))
                              : String(rec))
                          return <li key={index}>{displayText}</li>
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* AI Propose Modal */}
      {showProposeModal && proposeContent && (
        <div className="modal-overlay" onClick={() => setShowProposeModal(false)}>
          <div className="modal-content propose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 AI-Powered Security Analysis</h2>
              <button className="close-button" onClick={() => setShowProposeModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="success-message">
                <p>{proposeContent.message}</p>
              </div>
              
              {proposeContent.aiPowered && (
                <div className="ai-analysis">
                  <h3>🤖 AI-Powered Analysis ({proposeContent.aiModel})</h3>
                  
                      {proposeContent.summary && (
                        <div className="security-summary">
                          <h4>📊 Security Summary</h4>
                          
                          {proposeContent.summary.isFallback && (
                            <div className="fallback-warning-action" style={{ 
                              background: '#fff3cd', 
                              border: '2px solid #ffc107', 
                              borderRadius: '8px', 
                              padding: '1rem', 
                              marginBottom: '1.5rem',
                              fontSize: '0.95rem',
                              lineHeight: '1.6'
                            }}>
                              <div style={{ marginBottom: '0.75rem' }}>
                                <strong style={{ fontSize: '1.05rem', color: '#856404' }}>⚠️ AI Processing Incomplete</strong>
                              </div>
                              <div style={{ marginBottom: '0.75rem', color: '#856404' }}>
                                {proposeContent.summary.message || 'The AI analysis may still be processing. Raw output is shown below.'}
                              </div>
                              <div style={{ 
                                background: '#fff', 
                                borderRadius: '6px', 
                                padding: '0.75rem', 
                                border: '1px solid #ffc107',
                                marginBottom: '0.75rem'
                              }}>
                                <strong style={{ color: '#856404' }}>💡 For Judges:</strong> If you see raw JSON output, the AI job may still be processing. 
                                <strong> Click "AI Propose" again</strong> on the job card to get the formatted analysis.
                              </div>
                              {proposeJobId && (
                                <button
                                  onClick={() => {
                                    setShowProposeModal(false)
                                    setTimeout(() => {
                                      handlePropose(proposeJobId)
                                    }, 300)
                                  }}
                                  style={{
                                    background: '#ffc107',
                                    color: '#856404',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#ffb300'
                                    e.currentTarget.style.transform = 'scale(1.02)'
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = '#ffc107'
                                    e.currentTarget.style.transform = 'scale(1)'
                                  }}
                                >
                                  🔄 Retry AI Propose
                                </button>
                              )}
                            </div>
                          )}
                          
                          {proposeContent.summary.raw && (
                        <div className="raw-content">
                          {(() => {
                            // Try to parse and display JSON in a user-friendly format
                            let displayText = proposeContent.summary.raw
                            
                            // Remove common prefixes
                            displayText = displayText.replace(/^json\s*/i, '').trim()
                            
                            // Try multiple strategies to parse JSON
                            try {
                              // Strategy 1: Find outermost JSON object with balanced braces
                              let braceCount = 0
                              let startIdx = -1
                              let objStart = -1
                              let objEnd = -1
                              
                              for (let i = 0; i < displayText.length; i++) {
                                if (displayText[i] === '{') {
                                  if (startIdx === -1) startIdx = i
                                  if (objStart === -1) objStart = i
                                  braceCount++
                                } else if (displayText[i] === '}') {
                                  braceCount--
                                  if (braceCount === 0 && objStart !== -1) {
                                    objEnd = i + 1
                                    break
                                  }
                                }
                              }
                              
                              let jsonStr = null
                              if (objStart !== -1 && objEnd !== -1) {
                                jsonStr = displayText.substring(objStart, objEnd)
                              } else {
                                // Fallback to regex
                                const jsonMatch = displayText.match(/\{[\s\S]*\}/)
                                if (jsonMatch) jsonStr = jsonMatch[0]
                              }
                              
                              if (jsonStr) {
                                const parsed = JSON.parse(jsonStr)
                                
                                // If it has a summary key, extract and format that
                                if (parsed.summary && typeof parsed.summary === 'object') {
                                  const summary = parsed.summary
                                  
                                  // If summary has issues array, format nicely
                                  if (summary.issues && Array.isArray(summary.issues)) {
                                    return (
                                      <div className="issues-list">
                                        {summary.issues.map((issue, idx) => (
                                          <div key={idx} className={`issue-item severity-${(issue.severity || 'unknown')?.toLowerCase()}`}>
                                            <strong>{issue.severity || 'UNKNOWN'}:</strong> {issue.title || issue.description || issue.issue || issue.name}
                                            {issue.description && issue.description !== issue.title && (
                                              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                                {issue.description}
                                              </div>
                                            )}
                                            {issue.business_impact && (
                                              <div className="business-impact-text" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                                {issue.business_impact}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  }
                                  
                                  // If summary has description, show that
                                  if (summary.description) {
                                    return (
                                      <div>
                                        <p>{summary.description}</p>
                                        {summary.issues && Array.isArray(summary.issues) && (
                                          <div className="issues-list">
                                            {summary.issues.map((issue, idx) => (
                                              <div key={idx} className={`issue-item severity-${(issue.severity || 'unknown')?.toLowerCase()}`}>
                                                <strong>{issue.severity || 'UNKNOWN'}:</strong> {issue.title || issue.description || issue.issue || issue.name}
                                                {issue.description && issue.description !== (issue.title || issue.issue) && (
                                                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                                    {issue.description}
                                                  </div>
                                                )}
                                                {issue.business_impact && (
                                                  <div className="business-impact-text" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                                    {issue.business_impact}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  }
                                  
                                  // If summary is just an object, try to extract issues from top level
                                  if (Object.keys(summary).some(key => ['issues', 'description', 'critical', 'high', 'medium'].includes(key.toLowerCase()))) {
                                    return (
                                      <div>
                                        {summary.description && <p>{summary.description}</p>}
                                        {summary.issues && Array.isArray(summary.issues) && (
                                          <div className="issues-list">
                                            {summary.issues.map((issue, idx) => (
                                              <div key={idx} className={`issue-item severity-${(issue.severity || 'unknown')?.toLowerCase()}`}>
                                                <strong>{issue.severity || 'UNKNOWN'}:</strong> {issue.title || issue.description || issue.issue || issue.name}
                                                {issue.business_impact && (
                                                  <div className="business-impact-text" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                                    {issue.business_impact}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  }
                                }
                                
                                // If parsed object itself has an issues array, format nicely
                                if (parsed.issues && Array.isArray(parsed.issues)) {
                                  return (
                                    <div className="issues-list">
                                      {parsed.issues.map((issue, idx) => (
                                        <div key={idx} className={`issue-item severity-${(issue.severity || 'unknown')?.toLowerCase()}`}>
                                          <strong>{issue.severity || 'UNKNOWN'}:</strong> {issue.title || issue.description || issue.issue || issue.name}
                                          {issue.business_impact && (
                                            <div className="business-impact-text" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                              {issue.business_impact}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )
                                }
                                
                                // Otherwise, show formatted JSON (better than raw, but should rarely happen)
                                return (
                                  <pre style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                                    {JSON.stringify(parsed, null, 2)}
                                  </pre>
                                )
                              }
                            } catch (e) {
                              // Not parseable JSON, display as plain text but try to clean it up
                              const cleaned = displayText.replace(/^json\s*/i, '').trim()
                              return (
                                <pre style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                                  {cleaned}
                                </pre>
                              )
                            }
                          })()}
                        </div>
                      )}
                      
                      {proposeContent.summary.description && !proposeContent.summary.raw && (
                        <div className="summary-description">
                          <p>{proposeContent.summary.description}</p>
                        </div>
                      )}
                      
                      {proposeContent.summary.issues && Array.isArray(proposeContent.summary.issues) && (
                        <div className="issues-list">
                          {proposeContent.summary.issues.map((issue, index) => (
                            <div key={index} className={`issue-item severity-${(issue.severity || 'unknown')?.toLowerCase()}`}>
                              <strong>{issue.severity || 'UNKNOWN'}:</strong> {issue.title || issue.description || issue.name || JSON.stringify(issue)}
                              {issue.business_impact && (
                                <div className="business-impact-text" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                  {issue.business_impact}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Handle summary object - display issues nicely if available */}
                      {!proposeContent.summary.raw && !proposeContent.summary.description && !proposeContent.summary.issues && 
                       typeof proposeContent.summary === 'object' && Object.keys(proposeContent.summary).length > 0 && (
                        <div className="summary-structure">
                          {Object.entries(proposeContent.summary).map(([key, value]) => {
                            // Skip empty values
                            if (!value || (Array.isArray(value) && value.length === 0)) {
                              return null
                            }
                            
                            // Display severity-based sections
                            if (['critical', 'high', 'medium', 'low'].includes(key.toLowerCase())) {
                              const severity = key.toUpperCase()
                              return (
                                <div key={key} className={`${key.toLowerCase()}-section`}>
                                  <h5>{severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : severity === 'MEDIUM' ? '🟡' : '🟢'} {severity}</h5>
                                  {Array.isArray(value) ? (
                                    <ul>
                                      {value.map((item, idx) => (
                                        <li key={idx}>
                                          {typeof item === 'object' ? (
                                            <>
                                              {item.title || item.description || item.issue}
                                              {item.business_impact && (
                                                <div className="business-impact-text" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                                  {item.business_impact}
                                                </div>
                                              )}
                                            </>
                                          ) : String(item)}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</p>
                                  )}
                                </div>
                              )
                            }
                            
                            // For other keys, show as formatted key-value
                            return (
                              <div key={key} className="summary-entry">
                                <strong>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong>
                                {typeof value === 'object' ? (
                                  <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                                    {JSON.stringify(value, null, 2)}
                                  </pre>
                                ) : (
                                  <span> {String(value)}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      
                      {proposeContent.summary.critical && (
                        <div className="critical-section">
                          <h5>🔴 CRITICAL</h5>
                          {Array.isArray(proposeContent.summary.critical) ? (
                            <ul>
                              {proposeContent.summary.critical.map((issue, index) => (
                                <li key={index}>{typeof issue === 'object' ? JSON.stringify(issue, null, 2) : String(issue)}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{typeof proposeContent.summary.critical === 'object' ? JSON.stringify(proposeContent.summary.critical, null, 2) : String(proposeContent.summary.critical)}</p>
                          )}
                        </div>
                      )}
                      
                      {proposeContent.summary.high && (
                        <div className="high-section">
                          <h5>🟠 HIGH Priority Issues</h5>
                          {Array.isArray(proposeContent.summary.high) ? (
                            <ul>
                              {proposeContent.summary.high.map((issue, index) => (
                                <li key={index}>{typeof issue === 'object' ? JSON.stringify(issue, null, 2) : String(issue)}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{typeof proposeContent.summary.high === 'object' ? JSON.stringify(proposeContent.summary.high, null, 2) : String(proposeContent.summary.high)}</p>
                          )}
                        </div>
                      )}
                      
                      {proposeContent.summary.medium && (
                        <div className="medium-section">
                          <h5>🟡 MEDIUM Priority Issues</h5>
                          {Array.isArray(proposeContent.summary.medium) ? (
                            <ul>
                              {proposeContent.summary.medium.map((issue, index) => (
                                <li key={index}>{typeof issue === 'object' ? JSON.stringify(issue, null, 2) : String(issue)}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{typeof proposeContent.summary.medium === 'object' ? JSON.stringify(proposeContent.summary.medium, null, 2) : String(proposeContent.summary.medium)}</p>
                          )}
                        </div>
                      )}
                      
                      {proposeContent.summary.low && (
                        <div className="low-section">
                          <h5>🟢 LOW Priority Issues</h5>
                          <p>{typeof proposeContent.summary.low === 'object' ? JSON.stringify(proposeContent.summary.low, null, 2) : String(proposeContent.summary.low)}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {proposeContent.implementationSteps && (
                    <div className="implementation-steps">
                      <h4>📋 Implementation Steps</h4>
                      {Array.isArray(proposeContent.implementationSteps) ? (
                        <ol>
                          {proposeContent.implementationSteps.map((step, index) => {
                            // Handle if step is an object
                            const stepText = typeof step === 'object' && step !== null
                              ? (step.text || step.description || step.step || JSON.stringify(step, null, 2))
                              : String(step)
                            return <li key={index}>{stepText}</li>
                          })}
                        </ol>
                      ) : typeof proposeContent.implementationSteps === 'object' && proposeContent.implementationSteps !== null ? (
                        // Handle object structure with keys like "VPC Connector", "Authentication", etc.
                        Object.entries(proposeContent.implementationSteps).map(([category, steps]) => (
                          <div key={category} className="implementation-category">
                            <h5>{category}</h5>
                            {Array.isArray(steps) ? (
                              <ol>
                                {steps.map((step, index) => {
                                  const stepText = typeof step === 'object' && step !== null
                                    ? (step.text || step.description || step.step || JSON.stringify(step, null, 2))
                                    : String(step)
                                  return <li key={index}>{stepText}</li>
                                })}
                              </ol>
                            ) : typeof steps === 'object' && steps !== null ? (
                              <pre>{JSON.stringify(steps, null, 2)}</pre>
                            ) : (
                              <p>{String(steps)}</p>
                            )}
                          </div>
                        ))
                      ) : null}
                    </div>
                  )}
                  
                  {proposeContent.testingRecommendations && (
                    <div className="testing-recommendations">
                      <h4>🧪 Testing Recommendations</h4>
                      {Array.isArray(proposeContent.testingRecommendations) ? (
                        <ul>
                          {proposeContent.testingRecommendations.map((rec, index) => {
                            // Handle if rec is an object
                            const recText = typeof rec === 'object' && rec !== null
                              ? (rec.text || rec.description || rec.recommendation || JSON.stringify(rec, null, 2))
                              : String(rec)
                            return <li key={index}>{recText}</li>
                          })}
                        </ul>
                      ) : typeof proposeContent.testingRecommendations === 'object' && proposeContent.testingRecommendations !== null ? (
                        // Handle object structure with keys like "VPC Connector", "Authentication", etc.
                        Object.entries(proposeContent.testingRecommendations).map(([category, recommendations]) => (
                          <div key={category} className="testing-category">
                            <h5>{category}</h5>
                            {Array.isArray(recommendations) ? (
                              <ul>
                                {recommendations.map((rec, index) => {
                                  const recText = typeof rec === 'object' && rec !== null
                                    ? (rec.text || rec.description || rec.recommendation || JSON.stringify(rec, null, 2))
                                    : String(rec)
                                  return <li key={index}>{recText}</li>
                                })}
                              </ul>
                            ) : typeof recommendations === 'object' && recommendations !== null ? (
                              <pre>{JSON.stringify(recommendations, null, 2)}</pre>
                            ) : (
                              <p>{String(recommendations)}</p>
                            )}
                          </div>
                        ))
                      ) : null}
                    </div>
                  )}
                  
                  {proposeContent.terraformCode && (
                    <div className="terraform-code">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4>📝 Generated Terraform Code</h4>
                        <button
                          onClick={async () => {
                            const terraformText = proposeContent.terraformCode
                            const success = await copyText(terraformText)
                            if (success) {
                              notify.ok('Terraform copied')
                            } else {
                              notify.err('Copy failed')
                            }
                          }}
                          aria-label="Copy Terraform code"
                          className="copy-terraform-btn"
                          style={{ 
                            padding: '0.25rem 0.5rem', 
                            fontSize: '0.75rem', 
                            borderRadius: '4px', 
                            background: '#e2e8f0', 
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                        >
                          Copy Terraform
                        </button>
                      </div>
                      <pre><code>{formatTerraformCode(proposeContent.terraformCode)}</code></pre>
                    </div>
                  )}
                  
                  {proposeContent.terraformCodeBlocks && (
                    <div className="terraform-code-blocks">
                      <h4>📝 Generated Terraform Code</h4>
                      {Object.entries(proposeContent.terraformCodeBlocks).map(([key, codeBlock]) => {
                        let displayCode = ''
                        let description = ''
                        let severity = null
                        
                        if (typeof codeBlock === 'string') {
                          displayCode = codeBlock
                        } else if (codeBlock && typeof codeBlock === 'object') {
                          // Handle different code block structures
                          displayCode = codeBlock.code || codeBlock.terraform_code || codeBlock.terraform || codeBlock.text || ''
                          description = codeBlock.description || codeBlock.desc || ''
                          severity = codeBlock.severity || codeBlock.level || null
                          
                          // If code is still empty, try to stringify the whole object
                          if (!displayCode && Object.keys(codeBlock).length > 0) {
                            // Skip description and severity when stringifying
                            const codeOnly = { ...codeBlock }
                            delete codeOnly.description
                            delete codeOnly.desc
                            delete codeOnly.severity
                            delete codeOnly.level
                            if (Object.keys(codeOnly).length > 0) {
                              displayCode = JSON.stringify(codeOnly, null, 2)
                            }
                          }
                        }
                        
                        // Ensure displayCode is a string
                        if (displayCode && typeof displayCode !== 'string') {
                          displayCode = String(displayCode)
                        }
                        
                        return (
                          <div key={key} className="terraform-code-block">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <h5>
                                {severity && <span className={`severity-badge severity-${severity.toLowerCase()}`} style={{ marginRight: '0.5rem' }}>{severity}</span>}
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </h5>
                              {displayCode && (
                                <button
                                  onClick={async () => {
                                    const success = await copyText(displayCode)
                                    if (success) {
                                      notify.ok('Terraform copied')
                                    } else {
                                      notify.err('Copy failed')
                                    }
                                  }}
                                  aria-label="Copy Terraform code"
                                  className="copy-terraform-btn"
                                  style={{ 
                                    padding: '0.25rem 0.5rem', 
                                    fontSize: '0.75rem', 
                                    borderRadius: '4px', 
                                    background: '#e2e8f0', 
                                    border: '1px solid #cbd5e1',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                  }}
                                >
                                  Copy Terraform
                                </button>
                              )}
                            </div>
                            {description && <p className="code-description">{description}</p>}
                            {displayCode && (
                              <pre><code>{formatTerraformCode(displayCode)}</code></pre>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Policy Troubleshooter Result Callout */}
              {proposeContent.policyCheck && (
                <div className="policy-check-callout" role="alert">
                  {proposeContent.policyCheck.preserved ? (
                    <div className="policy-check-success">
                      ✅ Critical permissions preserved
                    </div>
                  ) : (
                    <div className="policy-check-warning">
                      ⚠️ Review: {proposeContent.policyCheck.missing || 'Some permissions not preserved'}
                    </div>
                  )}
                </div>
              )}

              {proposeContent.reportUrl && (
                <div className="report-link">
                  <h4>📄 Full Report</h4>
                  <div className="report-link-row">
                    <a href={proposeContent.reportUrl} target="_blank" rel="noopener noreferrer">
                      {proposeContent.reportUrl}
                    </a>
                    <button
                      className="copy-link-btn"
                      onClick={() => handleCopyLink(proposeContent.reportUrl)}
                      aria-label="Copy link"
                      title="Copy link"
                    >
                      📋 Copy link
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowProposeModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

