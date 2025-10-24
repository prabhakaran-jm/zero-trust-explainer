import './FindingsList.css'

function FindingsList({ findings, onExplain, loading }) {
  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745'
    }
    return colors[severity?.toLowerCase()] || '#6c757d'
  }

  if (loading) {
    return <div className="loading">Loading findings...</div>
  }

  if (findings.length === 0) {
    return <div className="no-findings">No findings for this job.</div>
  }

  return (
    <div className="findings-list">
      {findings.map((finding) => (
        <div key={finding.id} className="finding-card">
          <div className="finding-header">
            <span 
              className="severity-badge" 
              style={{ background: getSeverityColor(finding.severity) }}
            >
              {finding.severity}
            </span>
            <span className="resource-type">{finding.resource_type}</span>
          </div>

          <h4 className="resource-name">{finding.resource_name}</h4>
          
          <p className="issue-description">{finding.issue_description}</p>
          
          <div className="recommendation">
            <strong>Recommendation:</strong> {finding.recommendation}
          </div>

          <div className="finding-footer">
            <small className="finding-time">
              {finding.created_at && new Date(finding.created_at).toLocaleString()}
            </small>
            <button 
              className="explain-btn ai-powered-btn"
              onClick={() => onExplain(finding.id)}
            >
              🤖 AI Explain
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FindingsList
