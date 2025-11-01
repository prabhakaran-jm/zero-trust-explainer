import { useState, useEffect, useCallback } from 'react'
import './App.css'
import ScanForm from './components/ScanForm'
import JobCard from './components/JobCard'
import FindingsList from './components/FindingsList'
import HealthChip from './components/HealthChip'
import Spinner from './components/Spinner'
import { api } from './services/api'
import { notify } from './utils/notify'
import { copyToClipboard } from './utils/clipboard'
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
      setJobs(data.jobs || [])
    } catch (err) {
      console.error('Error loading jobs:', err)
    }
  }, [])

  usePolling(fetchJobs, 3000, autoRefresh)

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
      
      // Insert new job at the top if it appears
      setTimeout(async () => {
        const data = await api.listJobs()
        const jobExists = data.jobs?.some(job => job.job_id === jobId)
        if (jobExists) {
          setJobs(data.jobs || [])
        }
      }, 2000)
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
        // Use the direct fields from ai_proposals
        const proposals = result.ai_proposals
        
        console.log('AI Proposals:', proposals) // Debug logging
        
        // Handle summary - it can be a string or object
        if (proposals.ai_proposal) {
          if (typeof proposals.ai_proposal === 'string') {
            content.summary = { raw: proposals.ai_proposal }
          } else {
            content.summary = proposals.ai_proposal
          }
        }
        
        // Handle implementation steps - expect array of strings
        if (proposals.implementation_steps) {
          content.implementationSteps = proposals.implementation_steps
        }
        
        // Handle testing recommendations - expect array of strings
        if (proposals.testing_recommendations) {
          content.testingRecommendations = proposals.testing_recommendations
        }
        
        // Handle Terraform code
        if (proposals.terraform_code) {
          if (typeof proposals.terraform_code === 'string') {
            content.terraformCode = proposals.terraform_code
          } else if (typeof proposals.terraform_code === 'object') {
            content.terraformCodeBlocks = proposals.terraform_code
          }
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

  // Quick links from env vars
  const quickLinks = {
    video: import.meta.env.VITE_DEMO_VIDEO_URL,
    repo: import.meta.env.VITE_REPO_URL,
    architecture: import.meta.env.VITE_ARCH_URL,
    aiStudio: import.meta.env.VITE_AI_STUDIO_URL
  }
  const hasQuickLinks = Object.values(quickLinks).some(Boolean)

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
            {hasQuickLinks && (
              <div className="quick-links">
                {quickLinks.video && (
                  <a href={quickLinks.video} target="_blank" rel="noreferrer">Video</a>
                )}
                {quickLinks.repo && (
                  <>
                    {quickLinks.video && ' · '}
                    <a href={quickLinks.repo} target="_blank" rel="noreferrer">Repo</a>
                  </>
                )}
                {quickLinks.architecture && (
                  <>
                    {(quickLinks.video || quickLinks.repo) && ' · '}
                    <a href={quickLinks.architecture} target="_blank" rel="noreferrer">Architecture</a>
                  </>
                )}
                {quickLinks.aiStudio && (
                  <>
                    {(quickLinks.video || quickLinks.repo || quickLinks.architecture) && ' · '}
                    <a href={quickLinks.aiStudio} target="_blank" rel="noreferrer">AI Studio</a>
                  </>
                )}
              </div>
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
                onSelect={() => setSelectedJobId(job.job_id)}
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
          <section className="findings-section">
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
                      
                      {proposeContent.summary.critical && (
                        <div className="critical-section">
                          <h5>🔴 CRITICAL</h5>
                          <p>{proposeContent.summary.critical}</p>
                        </div>
                      )}
                      
                      {proposeContent.summary.high && (
                        <div className="high-section">
                          <h5>🟠 HIGH Priority Issues</h5>
                          {Array.isArray(proposeContent.summary.high) ? (
                            <ul>
                              {proposeContent.summary.high.map((issue, index) => (
                                <li key={index}>{issue}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{proposeContent.summary.high}</p>
                          )}
                        </div>
                      )}
                      
                      {proposeContent.summary.medium && (
                        <div className="medium-section">
                          <h5>🟡 MEDIUM Priority Issues</h5>
                          {Array.isArray(proposeContent.summary.medium) ? (
                            <ul>
                              {proposeContent.summary.medium.map((issue, index) => (
                                <li key={index}>{issue}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{proposeContent.summary.medium}</p>
                          )}
                        </div>
                      )}
                      
                      {proposeContent.summary.low && (
                        <div className="low-section">
                          <h5>🟢 LOW Priority Issues</h5>
                          <p>{proposeContent.summary.low}</p>
                        </div>
                      )}
                      
                      {proposeContent.summary.raw && (
                        <div className="raw-content">
                          <p style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                            {proposeContent.summary.raw}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {proposeContent.implementationSteps && (
                    <div className="implementation-steps">
                      <h4>📋 Implementation Steps</h4>
                      {Array.isArray(proposeContent.implementationSteps) ? (
                        <ol>
                          {proposeContent.implementationSteps.map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      ) : typeof proposeContent.implementationSteps === 'object' ? (
                        // Handle object structure with keys like "VPC Connector", "Authentication", etc.
                        Object.entries(proposeContent.implementationSteps).map(([category, steps]) => (
                          <div key={category} className="implementation-category">
                            <h5>{category}</h5>
                            {Array.isArray(steps) ? (
                              <ol>
                                {steps.map((step, index) => (
                                  <li key={index}>{step}</li>
                                ))}
                              </ol>
                            ) : (
                              <p>{steps}</p>
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
                          {proposeContent.testingRecommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      ) : typeof proposeContent.testingRecommendations === 'object' ? (
                        // Handle object structure with keys like "VPC Connector", "Authentication", etc.
                        Object.entries(proposeContent.testingRecommendations).map(([category, recommendations]) => (
                          <div key={category} className="testing-category">
                            <h5>{category}</h5>
                            {Array.isArray(recommendations) ? (
                              <ul>
                                {recommendations.map((rec, index) => (
                                  <li key={index}>{rec}</li>
                                ))}
                              </ul>
                            ) : (
                              <p>{recommendations}</p>
                            )}
                          </div>
                        ))
                      ) : null}
                    </div>
                  )}
                  
                  {proposeContent.terraformCode && (
                    <div className="terraform-code">
                      <h4>📝 Generated Terraform Code</h4>
                      <pre><code>{proposeContent.terraformCode}</code></pre>
                    </div>
                  )}
                  
                  {proposeContent.terraformCodeBlocks && (
                    <div className="terraform-code-blocks">
                      <h4>📝 Generated Terraform Code</h4>
                      {Object.entries(proposeContent.terraformCodeBlocks).map(([key, codeBlock]) => {
                        let displayCode = ''
                        let description = ''
                        
                        if (typeof codeBlock === 'string') {
                          displayCode = codeBlock
                        } else if (codeBlock && typeof codeBlock === 'object') {
                          if (codeBlock.code) {
                            displayCode = codeBlock.code
                          } else if (codeBlock.terraform_code || codeBlock.terraform) {
                            displayCode = codeBlock.terraform_code || codeBlock.terraform
                          }
                          if (codeBlock.description) {
                            description = codeBlock.description
                          }
                        }
                        
                        return (
                          <div key={key} className="terraform-code-block">
                            <h5>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h5>
                            {description && <p className="code-description">{description}</p>}
                            {displayCode && <pre><code>{displayCode}</code></pre>}
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

