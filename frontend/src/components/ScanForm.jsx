import { useState } from 'react'
import { notify } from '../utils/notify'
import Spinner from './Spinner'
import './ScanForm.css'

function ScanForm({ onSubmit, loading }) {
  const [serviceName, setServiceName] = useState('')
  const [region, setRegion] = useState('')
  const [projectId, setProjectId] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!serviceName) {
      notify.err('Service name is required')
      return
    }
    onSubmit(serviceName, region, projectId)
    // Reset form
    setServiceName('')
    setRegion('')
    setProjectId('')
  }

  return (
    <form className="scan-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="serviceName">Service Name *</label>
        <input
          id="serviceName"
          type="text"
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
          placeholder="my-cloud-run-service"
          required
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="region">Region</label>
        <input
          id="region"
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="us-central1 (optional)"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="projectId">Project ID</label>
        <input
          id="projectId"
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="my-gcp-project (optional)"
          disabled={loading}
        />
      </div>

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? (
          <>
            <Spinner size="14px" /> Submitting...
          </>
        ) : (
          '🔍 Start Scan'
        )}
      </button>
    </form>
  )
}

export default ScanForm
