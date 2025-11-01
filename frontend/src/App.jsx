import { useState, useEffect, useCallback } from 'react'
import './App.css'
import ScanForm from './components/ScanForm'
import JobCard from './components/JobCard'
import FindingsList from './components/FindingsList'
import HealthChip from './components/HealthChip'
import Spinner from './components/Spinner'
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
  const [showProposeModal, setShowProposeModal] = useState(false)
  const [proposeContent, setProposeContent] = useState(null)
  const [aiLoading, setAiLoading] = useState({ explain: null, propose: null })
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [findingsError, setFindingsError] = useState(null)

  useEffect(() => {
    loadJobs()
    checkAIStatus()
  }, [])

  // Auto-refresh polling after scan
  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.listJobs()
      // Sort jobs by first_finding_at descending (newest first)
      const sortedJobs = (data.jobs || []).sort((a, b) => {
        if (!a.first_finding_at && !b.first_finding_at) return 0
        if (!a.first_finding_at) return 1
        if (!b.first_finding_at) return -1
        return new Date(b.first_finding_at) - new Date(a.first_finding_at)
      })
      setJobs(sortedJobs)
    } catch (err) {
      console.error('Error loading jobs:', err)
    }
  }, [])

  usePolling(fetchJobs, 3000, autoRefresh)
  
  // Debug logging for auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      console.log('Auto-refresh enabled, polling every 3s for 20s')
    } else {
      console.log('Auto-refresh disabled')
    }
  }, [autoRefresh])

  useEffect(() => {
    if (autoRefresh) {
      const timer = setTimeout(() => setAutoRefresh(false), 20000) // Stop after 20s
      return () => clearTimeout(timer)
    }
  }, [autoRefresh])

  const checkAIStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/`)
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
      setJobs(data.jobs || [])
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
      
      // Start auto-refresh polling for ~20 seconds
      setAutoRefresh(true)
      setLoading(false)
      
      // Force immediate fetch to check for new job (polling will continue automatically)
      // Give it a moment for the job to appear in BigQuery
      setTimeout(() => {
        fetchJobs()
      }, 2000)
      
      // Also fetch again after a longer delay to catch jobs that take time to process
      setTimeout(() => {
        fetchJobs()
      }, 5000)
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
          
          return hasFallbackTerraform && hasFallbackSteps && hasFallbackTesting
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
              message: '⚠️ AI response was partially parsed. Showing raw summary below.'
            }
          } else if (normalized && normalized.summary) {
            // Use normalized summary if available
            content.summary = normalized.summary
            if (content.summary.raw) {
              content.summary.isFallback = true
              content.summary.message = '⚠️ AI response format was unexpected. Showing content below.'
            }
          } else {
            // Last resort - show error message
            content.summary = { 
              raw: 'The AI response could not be parsed. This may be due to:\n- Network issues\n- AI service temporarily unavailable\n- Response format issues\n\nPlease try again or check the full report link below.',
              isFallback: true
            }
          }
          
          // Still show what we have, even if minimal
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
          // Normal response - use normalized data
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
          // Normalization failed but not a known fallback
          content.summary = { raw: String(result.ai_proposals) }
        }
      }
      
      setProposeContent(content)
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

  // Quick links from env vars - only show if values exist
  const links = [
    { label: 'Video', href: import.meta.env.VITE_DEMO_VIDEO_URL },
    { label: 'Repo', href: import.meta.env.VITE_REPO_URL },
    { label: 'Architecture', href: import.meta.env.VITE_ARCH_URL },
    { label: 'AI Studio', href: import.meta.env.VITE_AI_STUDIO_URL }
  ].filter(x => !!x.href)

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div>
            <h1>🛡️ Zero-Trust Explainer</h1>
            <p>Human-readable IAM diffs for Cloud Run</p>
          </div>
          <div className="header-right">
            <HealthChip apiBase={import.meta.env.VITE_API_URL || 'http://localhost:8080'} />
            {links.length > 0 && (
              <nav className="quick-links">
                {links.map(l => (
                  <a 
                    key={l.label} 
                    href={l.href} 
                    target="_blank" 
                    rel="noreferrer"
                    className="quick-link-item"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            )}
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
                onPropose={handlePropose}
                onCopyJobId={handleCopyJobId}
                aiLoading={aiLoading}
              />
            ))}
            {jobs.length === 0 && !loading && (
              <div className="no-data">
                <p>No scan jobs yet. Click Start Scan, then we'll refresh your results.</p>
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
                          
                          {proposeContent.summary.isFallback && proposeContent.summary.message && (
                            <div className="fallback-warning" style={{ 
                              background: '#fff3cd', 
                              border: '1px solid #ffc107', 
                              borderRadius: '8px', 
                              padding: '0.75rem', 
                              marginBottom: '1rem',
                              fontSize: '0.9rem'
                            }}>
                              <strong>⚠️ Notice:</strong> {proposeContent.summary.message}
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

