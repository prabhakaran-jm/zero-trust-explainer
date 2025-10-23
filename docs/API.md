# API Documentation

Zero-Trust Explainer REST API reference.

## Base URL
```
https://your-backend-url.run.app
```

## Authentication
Currently, the API allows public access. In production, configure IAM-based authentication.

## Endpoints

### Health Check

#### GET /
Check if the service is running.

**Response**
```json
{
  "status": "ok",
  "service": "Zero-Trust Explainer API",
  "version": "1.0.0"
}
```

#### GET /health
Health check endpoint.

**Response**
```json
{
  "status": "healthy"
}
```

---

### Scan Operations

#### POST /scan
Submit a new scan request for a Cloud Run service.

**Request Body**
```json
{
  "service_name": "my-cloud-run-service",
  "region": "us-central1",
  "project_id": "my-gcp-project"
}
```

**Parameters**
- `service_name` (string, required): Name of the Cloud Run service to scan
- `region` (string, optional): GCP region (defaults to environment variable)
- `project_id` (string, optional): GCP project ID (defaults to environment variable)

**Response** (201 Created)
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Scan request published successfully",
  "pubsub_message_id": "1234567890"
}
```

**Error Response** (500 Internal Server Error)
```json
{
  "detail": "Failed to publish scan request: <error message>"
}
```

---

### Finding Operations

#### GET /findings/{job_id}
Retrieve findings for a specific scan job.

**Path Parameters**
- `job_id` (string, required): The job identifier

**Query Parameters**
- `severity` (string, optional): Filter by severity (critical, high, medium, low)
- `limit` (integer, optional): Maximum number of findings (default: 100)

**Response** (200 OK)
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "count": 5,
  "findings": [
    {
      "id": "finding-001",
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "severity": "critical",
      "resource_type": "cloud_run_service",
      "resource_name": "my-public-service",
      "issue_description": "Service allows unauthenticated access",
      "recommendation": "Remove allUsers from invoker role",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Error Response** (500 Internal Server Error)
```json
{
  "detail": "Failed to retrieve findings: <error message>"
}
```

---

#### GET /explain/{finding_id}
Get detailed explanation for a specific finding with blast radius analysis.

**Path Parameters**
- `finding_id` (string, required): The finding identifier

**Response** (200 OK)
```json
{
  "id": "finding-001",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "severity": "critical",
  "resource_type": "cloud_run_service",
  "resource_name": "my-public-service",
  "issue_description": "Service allows unauthenticated access",
  "recommendation": "Remove allUsers from invoker role",
  "blast_radius": {
    "description": "Public access allows any internet user to invoke the service",
    "affected_resources": ["my-public-service", "downstream-api"],
    "risk_score": 95
  },
  "explanation": "This critical severity issue affects my-public-service...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Response** (404 Not Found)
```json
{
  "detail": "Finding finding-001 not found"
}
```

---

### Proposal Operations

#### POST /propose/{job_id}
Trigger Cloud Run Job to propose least-privilege fixes.

**Path Parameters**
- `job_id` (string, required): The job identifier

**Request Body** (Optional)
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "findings_ids": ["finding-001", "finding-002"]
}
```

**Parameters**
- `findings_ids` (array, optional): Specific finding IDs to include in proposal

**Response** (200 OK)
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "triggered",
  "execution_name": "projects/my-project/locations/us-central1/jobs/zte-propose-job/executions/...",
  "report_url": "https://storage.googleapis.com/...",
  "message": "Propose job triggered successfully"
}
```

**Notes**
- `report_url` is only included if `REPORT_BUCKET` environment variable is set
- Signed URL is valid for 1 hour

**Error Response** (500 Internal Server Error)
```json
{
  "detail": "Failed to trigger propose job: <error message>"
}
```

---

### Job Operations

#### GET /jobs
List recent scan jobs with summary statistics.

**Query Parameters**
- `limit` (integer, optional): Maximum number of jobs (default: 50)

**Response** (200 OK)
```json
{
  "count": 10,
  "jobs": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "finding_count": 5,
      "severity_counts": {
        "critical": 1,
        "high": 2,
        "medium": 1,
        "low": 1
      },
      "first_finding_at": "2024-01-15T10:30:00Z",
      "last_finding_at": "2024-01-15T10:35:00Z"
    }
  ]
}
```

**Error Response** (500 Internal Server Error)
```json
{
  "detail": "Failed to list jobs: <error message>"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error - Something went wrong |

## Rate Limits

Currently, there are no enforced rate limits. In production, consider implementing:
- Per-IP rate limiting
- Per-user quotas
- Request throttling

## Examples

### Submit and Track a Scan

```bash
# 1. Submit scan
RESPONSE=$(curl -s -X POST https://your-backend-url.run.app/scan \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "my-service",
    "region": "us-central1"
  }')

JOB_ID=$(echo $RESPONSE | jq -r '.job_id')
echo "Job ID: $JOB_ID"

# 2. Wait for results (in practice, poll this endpoint)
sleep 10

# 3. Get findings
curl -s "https://your-backend-url.run.app/findings/${JOB_ID}" | jq

# 4. Get explanation for a specific finding
FINDING_ID=$(curl -s "https://your-backend-url.run.app/findings/${JOB_ID}" | jq -r '.findings[0].id')
curl -s "https://your-backend-url.run.app/explain/${FINDING_ID}" | jq

# 5. Trigger fix proposal
curl -s -X POST "https://your-backend-url.run.app/propose/${JOB_ID}" | jq
```

### Filter Findings by Severity

```bash
# Get only critical findings
curl -s "https://your-backend-url.run.app/findings/${JOB_ID}?severity=critical" | jq

# Get only high and critical
curl -s "https://your-backend-url.run.app/findings/${JOB_ID}?severity=high" | jq
```

### List All Jobs

```bash
# Get last 20 jobs
curl -s "https://your-backend-url.run.app/jobs?limit=20" | jq
```

## Integration Examples

### Python
```python
import requests

BASE_URL = "https://your-backend-url.run.app"

# Submit scan
response = requests.post(
    f"{BASE_URL}/scan",
    json={
        "service_name": "my-service",
        "region": "us-central1"
    }
)
job_id = response.json()["job_id"]

# Get findings
findings = requests.get(f"{BASE_URL}/findings/{job_id}").json()
print(f"Found {findings['count']} findings")

# Explain first finding
if findings['findings']:
    finding_id = findings['findings'][0]['id']
    explanation = requests.get(f"{BASE_URL}/explain/{finding_id}").json()
    print(explanation['explanation'])
```

### JavaScript
```javascript
const BASE_URL = 'https://your-backend-url.run.app';

// Submit scan
const scanResponse = await fetch(`${BASE_URL}/scan`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service_name: 'my-service',
    region: 'us-central1'
  })
});
const { job_id } = await scanResponse.json();

// Get findings
const findingsResponse = await fetch(`${BASE_URL}/findings/${job_id}`);
const findings = await findingsResponse.json();
console.log(`Found ${findings.count} findings`);

// Explain finding
if (findings.findings.length > 0) {
  const findingId = findings.findings[0].id;
  const explanationResponse = await fetch(`${BASE_URL}/explain/${findingId}`);
  const explanation = await explanationResponse.json();
  console.log(explanation.explanation);
}
```

## WebSocket Support

Not currently available. All operations are REST-based. For real-time updates, clients should poll the `/findings/{job_id}` endpoint.

## Versioning

Current version: v1.0.0

API versioning is not yet implemented. Future versions may use URL path versioning (e.g., `/v2/scan`).
