import './FindingsList.css'
import FindingCard from './FindingCard'
import Spinner from './Spinner'

function FindingsList({ findings, onExplain, loading, aiLoading, error }) {
  if (loading) {
    return (
      <div className="loading" aria-live="polite">
        <Spinner /> Loading findings...
      </div>
    )
  }

  if (error) {
    // Check for BigQuery configuration errors
    if (error.includes('500') || error.includes('404') || error.includes('BigQuery')) {
      return (
        <div className="error-banner" role="alert">
          <strong>⚠️ Findings unavailable</strong>
          <p>BigQuery not configured. Ask operator to set GCP_PROJECT_ID & BQ_DATASET on API.</p>
        </div>
      )
    }
    return (
      <div className="error-banner" role="alert">
        {error}
      </div>
    )
  }

  if (findings.length === 0) {
    return (
      <div className="no-findings">
        <p>No findings for this job. Try another job or run a new scan.</p>
      </div>
    )
  }

  return (
    <div className="findings-list">
      {findings.map((finding) => (
        <FindingCard
          key={finding.id}
          finding={finding}
          onExplain={onExplain}
          aiLoading={aiLoading}
        />
      ))}
    </div>
  )
}

export default FindingsList
