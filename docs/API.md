# API Documentation 🤖

Zero-Trust Explainer REST API reference with **AI-powered security analysis** using Google AI Studio and Gemini Pro.

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

#### GET /explain/{finding_id} 🤖
Get AI-powered detailed explanation for a specific finding with intelligent analysis.

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
  "ai_explanation": "This critical security vulnerability exposes your payment processing service to unauthorized access...",
  "blast_radius": "If exploited, this vulnerability could affect your entire application infrastructure, leading to data breaches...",
  "risk_assessment": "CRITICAL RISK - Immediate action required. This vulnerability poses significant business risk...",
  "priority_score": 95,
  "business_impact": "High",
  "remediation_urgency": "Immediate",
  "attack_vector": "Attackers can directly invoke the service without authentication...",
  "compliance_impact": "Potential SOC2 and PCI DSS violations due to unauthorized access",
  "ai_model": "gemini-2.0-flash",
  "ai_powered": true,
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

#### GET /summary/{job_id} 🤖
Generate AI-powered executive summary of scan results with strategic insights.

**Path Parameters**
- `job_id` (string, required): The job identifier

**Response** (200 OK)
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "summary": {
    "executive_summary": "Security scan completed with 7 findings. 4 high-priority issues require immediate attention...",
    "risk_overview": "Overall risk level: HIGH - Multiple critical vulnerabilities detected",
    "top_concerns": [
      "Payment processor service allows unauthenticated access",
      "Service account has excessive Editor permissions",
      "API keys stored as plain text environment variables"
    ],
    "compliance_status": "SOC2 and PCI DSS compliance at risk due to critical findings",
    "remediation_roadmap": "Phase 1: Address critical issues (1-2 days), Phase 2: High severity (1 week), Phase 3: Medium/Low (2-4 weeks)",
    "business_impact": "High",
    "recommendations": [
      "Implement immediate access controls",
      "Migrate to least-privilege IAM model",
      "Deploy Secret Manager for sensitive data"
    ],
    "severity_counts": {
      "CRITICAL": 1,
      "HIGH": 3,
      "MEDIUM": 2,
      "LOW": 1
    },
    "ai_model": "gemini-2.0-flash",
    "ai_powered": true
  },
  "total_findings": 7,
  "ai_powered": true
}
```

**Error Response** (404 Not Found)
```json
{
  "detail": "No findings found for job 550e8400-e29b-41d4-a716-446655440000"
}
```

---

### Proposal Operations

#### POST /propose/{job_id} 🤖
Trigger AI-powered Cloud Run Job to generate intelligent Terraform/IAM fixes with step-by-step guides.

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
  "message": "AI-powered propose job triggered successfully"
}
```

**Notes**
- `report_url` is only included if `REPORT_BUCKET` environment variable is set
- Signed URL is valid for 1 hour
- Report includes AI-generated Terraform code, implementation steps, and testing recommendations

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

# 4. Get AI explanation for a specific finding
FINDING_ID=$(curl -s "https://your-backend-url.run.app/findings/${JOB_ID}" | jq -r '.findings[0].id')
curl -s "https://your-backend-url.run.app/explain/${FINDING_ID}" | jq

# 5. Generate AI-powered executive summary
curl -s "https://your-backend-url.run.app/summary/${JOB_ID}" | jq

# 6. Trigger AI-powered fix proposal
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

# Explain first finding with AI
if findings['findings']:
    finding_id = findings['findings'][0]['id']
    explanation = requests.get(f"{BASE_URL}/explain/{finding_id}").json()
    print(f"AI Explanation: {explanation['ai_explanation']}")
    print(f"Risk Assessment: {explanation['risk_assessment']}")
    print(f"Business Impact: {explanation['business_impact']}")

# Generate AI summary
summary = requests.get(f"{BASE_URL}/summary/{job_id}").json()
print(f"Executive Summary: {summary['summary']['executive_summary']}")
print(f"Top Concerns: {summary['summary']['top_concerns']}")
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

// Explain finding with AI
if (findings.findings.length > 0) {
  const findingId = findings.findings[0].id;
  const explanationResponse = await fetch(`${BASE_URL}/explain/${findingId}`);
  const explanation = await explanationResponse.json();
  console.log(`AI Explanation: ${explanation.ai_explanation}`);
  console.log(`Risk Assessment: ${explanation.risk_assessment}`);
  console.log(`Business Impact: ${explanation.business_impact}`);
}

// Generate AI summary
const summaryResponse = await fetch(`${BASE_URL}/summary/${job_id}`);
const summary = await summaryResponse.json();
console.log(`Executive Summary: ${summary.summary.executive_summary}`);
console.log(`Top Concerns: ${summary.summary.top_concerns.join(', ')}`);
```

## WebSocket Support

Not currently available. All operations are REST-based. For real-time updates, clients should poll the `/findings/{job_id}` endpoint.

## Data Models

### Finding

Represents a security finding from a scan.

```typescript
interface Finding {
  id: string;                      // Unique finding identifier
  job_id: string;                  // Scan job identifier
  severity: string;                // Severity level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  resource_type: string;           // Type of resource (e.g., "cloud_run_service")
  resource_name: string;            // Name of the resource
  issue_description: string;       // Description of the security issue
  recommendation: string;           // Recommended fix
  blast_radius?: string;           // Blast radius description (AI-generated)
  affected_resources?: string;     // JSON array of affected resources (AI-generated)
  risk_score?: number;             // Risk score 0-100 (AI-generated)
  created_at: string;              // ISO 8601 timestamp
}
```

### Job Summary

Represents a scan job with summary statistics.

```typescript
interface JobSummary {
  job_id: string;                  // Job identifier
  finding_count: number;           // Total number of findings
  severity_counts: {              // Count of findings by severity
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  first_finding_at: string;        // ISO 8601 timestamp of first finding
  last_finding_at: string;         // ISO 8601 timestamp of last finding
}
```

### AI Explanation

AI-powered detailed explanation of a finding.

```typescript
interface AIExplanation {
  // Original finding fields
  id: string;
  job_id: string;
  severity: string;
  resource_type: string;
  resource_name: string;
  issue_description: string;
  recommendation: string;
  
  // AI-generated fields
  ai_explanation: string;          // Detailed technical explanation
  blast_radius: string;            // Blast radius analysis
  risk_assessment: string;          // Risk assessment with priority level
  priority_score: number;           // Numerical priority score (1-100)
  business_impact: "High" | "Medium" | "Low";  // Business impact assessment
  remediation_urgency: "Immediate" | "High" | "Medium" | "Low";  // Urgency level
  attack_vector: string;           // How the vulnerability could be exploited
  compliance_impact: string;       // Compliance violations (SOC2, PCI, etc.)
  ai_model: string;                // AI model used (e.g., "gemini-2.0-flash")
  ai_powered: true;                // Always true for AI explanations
  created_at: string;              // ISO 8601 timestamp
}
```

### AI Summary

AI-powered executive summary of scan results.

```typescript
interface AISummary {
  executive_summary: string;        // High-level overview for executives
  risk_overview: string;           // Overall risk assessment
  top_concerns: string[];          // Top 3 most critical issues
  compliance_status: string;       // Compliance impact assessment
  remediation_roadmap: string;     // Phased approach to fixing issues
  business_impact: string;          // Overall business risk assessment
  recommendations: string[];        // Strategic recommendations
  severity_counts: {               // Count of findings by severity
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  ai_model: string;                 // AI model used (e.g., "gemini-2.0-flash")
  ai_powered: true;                 // Always true for AI summaries
}
```

### AI Proposal

AI-generated fix proposal with Terraform code.

```typescript
interface AIProposal {
  // Summary by severity
  summary: {
    [key: string]: string;  // Key: "CRITICAL", "HIGH", etc. Value: summary text
  };
  
  // Terraform code by finding
  terraform_code: {
    [key: string]: {                // Key: finding identifier
      description: string;          // Description of the fix
      code: string;                 // Terraform code
    };
  };
  
  // Implementation steps by finding
  implementation_steps: {
    [key: string]: string[];        // Key: finding identifier, Value: array of steps
  };
  
  // Testing recommendations by finding
  testing_recommendations: {
    [key: string]: string[];        // Key: finding identifier, Value: array of recommendations
  };
  
  ai_model: string;                 // AI model used (e.g., "gemini-2.0-flash")
  ai_powered: true;                  // Always true for AI proposals
}
```

### Scan Request

Request to initiate a scan.

```typescript
interface ScanRequest {
  service_name: string;             // Name of Cloud Run service to scan
  region?: string;                   // GCP region (optional, defaults to env var)
  project_id?: string;               // GCP project ID (optional, defaults to env var)
}
```

### Scan Response

Response after submitting a scan.

```typescript
interface ScanResponse {
  job_id: string;                   // Generated job identifier
  status: "queued" | "processing" | "completed" | "failed";
  message: string;                   // Status message
  pubsub_message_id?: string;        // Pub/Sub message ID
}
```

## Versioning

Current version: v1.0.0

API versioning is not yet implemented. Future versions may use URL path versioning (e.g., `/v2/scan`).
