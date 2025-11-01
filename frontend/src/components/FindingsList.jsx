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

  // Check for known backend misconfigurations
  const bqUnavailable = error && (error.includes('500') || error.includes('404') || error.includes('BigQuery'))
  const signerMissing = error && (error.includes('signed') || error.includes('signer') || error.includes('REPORT_BUCKET'))

  if (error && !bqUnavailable && !signerMissing) {
    return (
      <div className="error-banner" role="alert">
        {error}
      </div>
    )
  }

  if (findings.length === 0) {
    return (
      <div>
        {bqUnavailable && (
          <div role="status" className="mb-3 px-3 py-2 text-sm rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
            Findings unavailable (BigQuery not configured). Set <code>GCP_PROJECT</code> & <code>BQ_DATASET</code> on the API.
          </div>
        )}
        {signerMissing && (
          <div role="status" className="mb-3 px-3 py-2 text-sm rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
            Report signing disabled. Set <code>REPORT_BUCKET</code> on the API to enable signed URLs.
          </div>
        )}
        <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
          No findings for this job. Try another job or run a new scan.
        </div>
      </div>
    )
  }

  return (
    <div className="findings-list">
      {bqUnavailable && (
        <div role="status" className="mb-3 px-3 py-2 text-sm rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
          Findings unavailable (BigQuery not configured). Set <code>GCP_PROJECT</code> & <code>BQ_DATASET</code> on the API.
        </div>
      )}
      {signerMissing && (
        <div role="status" className="mb-3 px-3 py-2 text-sm rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
          Report signing disabled. Set <code>REPORT_BUCKET</code> on the API to enable signed URLs.
        </div>
      )}
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
