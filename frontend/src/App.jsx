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

  useEffect(() => {
    loadJobs()
  }, [])

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
      const explanation = await api.explainFinding(findingId)
      alert(`Explanation:\n\n${explanation.explanation}\n\nBlast Radius: ${explanation.blast_radius.description}`)
    } catch (err) {
      setError('Failed to get explanation: ' + err.message)
      console.error('Error getting explanation:', err)
    }
  }

  const handlePropose = async (jobId) => {
    try {
      setLoading(true)
      setError(null)
      const result = await api.proposeFixes(jobId)
      let message = `Propose job triggered successfully!`
      if (result.report_url) {
        message += `\n\nReport URL: ${result.report_url}`
      }
      alert(message)
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
    </div>
  )
}

export default App
