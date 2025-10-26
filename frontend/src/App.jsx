import { useState, useEffect } from 'react'
import './App.css'
import ScanForm from './components/ScanForm'
import JobCard from './components/JobCard'
import FindingsList from './components/FindingsList'
import { api } from './services/api'

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

  useEffect(() => {
    loadJobs()
    checkAIStatus()
  }, [])

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
      const data = await api.getFindings(jobId, severity)
      setFindings(data.findings || [])
    } catch (err) {
      setError('Failed to load findings: ' + err.message)
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
      alert(`Scan queued successfully! Job ID: ${result.job_id}`)
      await loadJobs()
    } catch (err) {
      setError('Failed to submit scan: ' + err.message)
      console.error('Error submitting scan:', err)
    } finally {
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
      setLoading(true)
      const explanation = await api.explainFinding(findingId)
      setCurrentExplanation(explanation)
      setShowExplanation(true)
    } catch (err) {
      setError('Failed to get explanation: ' + err.message)
      console.error('Error getting explanation:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePropose = async (jobId) => {
    try {
      setLoading(true)
      setError(null)
      const result = await api.proposeFixes(jobId)
      
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
        terraformCode: null
      }
      
      if (result.ai_powered && result.ai_proposals) {
        // Parse the AI proposal JSON if it's a string
        let aiProposal = result.ai_proposals.ai_proposal
        if (typeof aiProposal === 'string') {
          try {
            // Remove markdown code blocks if present
            aiProposal = aiProposal.replace(/```json\n?/g, '').replace(/```\n?/g, '')
            const parsedProposal = JSON.parse(aiProposal)
            
            // Store parsed content for modal display
            content.summary = parsedProposal.summary
            content.implementationSteps = parsedProposal.implementation_steps
            content.testingRecommendations = parsedProposal.testing_recommendations
            
            // Process Terraform code - handle both simple string and complex object structure
            if (parsedProposal.terraform_code) {
              if (typeof parsedProposal.terraform_code === 'string') {
                // Clean up escape sequences in simple string
                content.terraformCode = parsedProposal.terraform_code
                  .replace(/\\n/g, '\n')
                  .replace(/\\t/g, '\t')
                  .replace(/\\"/g, '"')
              } else if (typeof parsedProposal.terraform_code === 'object') {
                // Handle complex terraform_code object with multiple code blocks
                const cleanedBlocks = {}
                Object.entries(parsedProposal.terraform_code).forEach(([key, codeBlock]) => {
                  if (typeof codeBlock === 'string') {
                    cleanedBlocks[key] = codeBlock
                      .replace(/\\n/g, '\n')
                      .replace(/\\t/g, '\t')
                      .replace(/\\"/g, '"')
                  } else if (codeBlock && typeof codeBlock === 'object' && codeBlock.code) {
                    cleanedBlocks[key] = {
                      ...codeBlock,
                      code: codeBlock.code
                        .replace(/\\n/g, '\n')
                        .replace(/\\t/g, '\t')
                        .replace(/\\"/g, '"')
                    }
                  } else {
                    cleanedBlocks[key] = codeBlock
                  }
                })
                content.terraformCodeBlocks = cleanedBlocks
              }
            }
            
          } catch (parseError) {
            // If parsing fails, store raw content
            content.summary = { raw: aiProposal }
          }
        } else {
          content.summary = { raw: aiProposal }
        }
        
        if (result.ai_proposals.terraform_code && result.ai_proposals.terraform_code !== "# Generated fixes - see summary above") {
          content.terraformCode = result.ai_proposals.terraform_code
        }
      }
      
      setProposeContent(content)
      setShowProposeModal(true)
    } catch (err) {
      setError('Failed to trigger propose: ' + err.message)
      console.error('Error triggering propose:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🛡️ Zero-Trust Explainer</h1>
        <p>Human-readable IAM diffs for Cloud Run</p>
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
              {loading ? 'Loading...' : '🔄 Refresh'}
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
              />
            ))}
            {jobs.length === 0 && !loading && (
              <p className="no-data">No jobs found. Submit a scan to get started.</p>
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
                      {proposeContent.implementationSteps.critical && (
                        <div className="critical-steps">
                          <h5>🔴 Critical Fixes</h5>
                          <ol>
                            {proposeContent.implementationSteps.critical.map((step, index) => (
                              <li key={index}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {proposeContent.testingRecommendations && (
                    <div className="testing-recommendations">
                      <h4>🧪 Testing Recommendations</h4>
                      {proposeContent.testingRecommendations.critical && (
                        <div className="critical-testing">
                          <h5>🔴 Critical Testing</h5>
                          <p>{proposeContent.testingRecommendations.critical}</p>
                        </div>
                      )}
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
                      {Object.entries(proposeContent.terraformCodeBlocks).map(([key, codeBlock]) => (
                        <div key={key} className="terraform-code-block">
                          <h5>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h5>
                          {typeof codeBlock === 'string' ? (
                            <pre><code>{codeBlock}</code></pre>
                          ) : codeBlock.code ? (
                            <pre><code>{codeBlock.code}</code></pre>
                          ) : (
                            <pre><code>{JSON.stringify(codeBlock, null, 2)}</code></pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {proposeContent.reportUrl && (
                <div className="report-link">
                  <h4>📄 Full Report</h4>
                  <a href={proposeContent.reportUrl} target="_blank" rel="noopener noreferrer">
                    {proposeContent.reportUrl}
                  </a>
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

