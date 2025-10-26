import './JobCard.css'

function JobCard({ job, isSelected, onSelect, onPropose, aiLoading }) {
  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745'
    }
    return colors[severity] || '#6c757d'
  }

  const totalFindings = job.finding_count || 0
  const severityCounts = job.severity_counts || {}

  return (
    <div 
      className={`job-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="job-card-header">
        <h3>Job: {job.job_id.substring(0, 8)}...</h3>
        <span className="finding-count">{totalFindings} findings</span>
      </div>

      <div className="severity-breakdown">
        {severityCounts.critical > 0 && (
          <div className="severity-item" style={{ color: getSeverityColor('critical') }}>
            <span className="severity-badge" style={{ background: getSeverityColor('critical') }}>
              {severityCounts.critical}
            </span>
            Critical
          </div>
        )}
        {severityCounts.high > 0 && (
          <div className="severity-item" style={{ color: getSeverityColor('high') }}>
            <span className="severity-badge" style={{ background: getSeverityColor('high') }}>
              {severityCounts.high}
            </span>
            High
          </div>
        )}
        {severityCounts.medium > 0 && (
          <div className="severity-item" style={{ color: getSeverityColor('medium') }}>
            <span className="severity-badge" style={{ background: getSeverityColor('medium') }}>
              {severityCounts.medium}
            </span>
            Medium
          </div>
        )}
        {severityCounts.low > 0 && (
          <div className="severity-item" style={{ color: getSeverityColor('low') }}>
            <span className="severity-badge" style={{ background: getSeverityColor('low') }}>
              {severityCounts.low}
            </span>
            Low
          </div>
        )}
      </div>

      <div className="job-card-footer">
        <small>
          {job.first_finding_at && new Date(job.first_finding_at).toLocaleString()}
        </small>
        <button 
          className="propose-btn ai-powered-btn"
          onClick={(e) => {
            e.stopPropagation()
            onPropose(job.job_id)
          }}
          disabled={aiLoading?.propose === job.job_id}
        >
          {aiLoading?.propose === job.job_id ? '⏳ Loading...' : '🤖 AI Propose'}
        </button>
      </div>
    </div>
  )
}

export default JobCard
