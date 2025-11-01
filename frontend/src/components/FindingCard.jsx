import { useState } from 'react'
import Spinner from './Spinner'

/**
 * Finding card with accordion for details, evidence, and SQL peek
 */
function FindingCard({ finding, onExplain, aiLoading }) {
  const [expanded, setExpanded] = useState(false)
  
  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745'
    }
    return colors[severity?.toLowerCase()] || '#6c757d'
  }

  const severityColor = getSeverityColor(finding.severity)
  const severityLabel = finding.severity?.toUpperCase() || 'UNKNOWN'

  // Hardcoded SQL query used by the API (read-only documentation)
  // Note: This is a simplified representation; actual query may vary
  const jobId = finding.job_id || 'example-job-id'
  const projectId = jobId.includes('-') ? jobId.split('-')[0] : 'PROJECT_ID'
  const bqQuery = `SELECT 
  id, job_id, severity, resource_type, resource_name,
  issue_description, recommendation, blast_radius,
  affected_resources, risk_score, created_at
FROM \`${projectId}.zero_trust_explainer.findings\`
WHERE job_id = '${jobId}'
ORDER BY 
  CASE severity 
    WHEN 'CRITICAL' THEN 1 
    WHEN 'HIGH' THEN 2 
    WHEN 'MEDIUM' THEN 3 
    WHEN 'LOW' THEN 4 
  END,
  risk_score DESC`

  return (
    <div className="finding-card">
      <div className="finding-header">
        <span 
          className="severity-badge" 
          style={{ background: severityColor }}
          aria-label={`Severity: ${severityLabel}`}
        >
          {severityLabel}
        </span>
        <span className="resource-type">{finding.resource_type}</span>
      </div>

      <h4 className="resource-name">{finding.resource_name}</h4>
      
      <p className="issue-description">{finding.issue_description}</p>
      
      <div className="recommendation">
        <strong>Recommendation:</strong> {finding.recommendation}
      </div>

      {/* Accordion for details */}
      <button 
        className="details-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        Details {expanded ? '▾' : '▸'}
      </button>

      {expanded && (
        <div className="finding-details">
          {/* Evidence reference if present */}
          {finding.evidence_ref && (
            <div className="evidence-section">
              <h5>Evidence</h5>
              <pre className="evidence-json">
                {typeof finding.evidence_ref === 'string' 
                  ? finding.evidence_ref 
                  : JSON.stringify(finding.evidence_ref, null, 2)}
              </pre>
            </div>
          )}

          {/* SQL Query peek */}
          <div className="sql-section">
            <h5>BigQuery Query</h5>
            <button 
              className="view-query-btn"
              onClick={() => {
                const modal = document.createElement('div')
                modal.className = 'query-modal-overlay'
                modal.innerHTML = `
                  <div class="query-modal-content">
                    <div class="query-modal-header">
                      <h3>BigQuery SELECT Query</h3>
                      <button class="close-btn" onclick="this.closest('.query-modal-overlay').remove()">×</button>
                    </div>
                    <pre><code>${bqQuery}</code></pre>
                    <button onclick="navigator.clipboard.writeText(\`${bqQuery.replace(/`/g, '\\`')}\`)">Copy Query</button>
                  </div>
                `
                document.body.appendChild(modal)
                modal.onclick = (e) => {
                  if (e.target === modal) modal.remove()
                }
              }}
            >
              View Query
            </button>
          </div>
        </div>
      )}

      <div className="finding-footer">
        <small className="finding-time">
          {finding.created_at && new Date(finding.created_at).toLocaleString()}
        </small>
        <button 
          className="explain-btn ai-powered-btn"
          onClick={() => onExplain(finding.id)}
          disabled={aiLoading?.explain === finding.id}
        >
          {aiLoading?.explain === finding.id ? (
            <>
              <Spinner size="14px" /> Loading...
            </>
          ) : (
            '🤖 AI Explain'
          )}
        </button>
      </div>
    </div>
  )
}

export default FindingCard

