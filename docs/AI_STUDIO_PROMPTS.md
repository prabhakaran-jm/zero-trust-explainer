# AI Studio Prompts - Zero-Trust Explainer

This document contains the AI Studio prompts used in the Zero-Trust Explainer application to demonstrate Google AI Studio integration for the Cloud Run Hackathon.

## Overview

The application uses Google AI Studio with Gemini Pro to provide three AI-powered security analysis features:

1. **Security Finding Explanation** - AI analyzes findings and provides blast radius, risk assessment, and business impact
2. **Scan Summary Generation** - AI creates executive summaries with compliance impact and strategic recommendations  
3. **Fix Proposal Generation** - AI generates production-ready Terraform remediation code with implementation guides

All prompts are executed via the Google Generative AI SDK (`google-generativeai`) and integrated with Cloud Run services.

---

## Prompt 1: Security Finding Explanation

**Purpose**: Generate comprehensive AI-powered security analysis with blast radius, risk assessment, business impact, attack vector, and compliance considerations.

**Endpoint**: `GET /explain/{finding_id}`  
**Implementation**: `backend/main.py` lines 156-177

**Full Prompt**:
```
You are a cybersecurity expert analyzing Google Cloud security findings. Provide intelligent risk prioritization.

Finding Details:
- Resource Type: {resource_type}
- Resource Name: {resource_name}
- Severity: {severity}
- Issue: {issue_description}
- Recommendation: {recommendation}
- Risk Score: {risk_score}/100
- Affected Resources: {affected_resources}

Provide comprehensive analysis in JSON format with these keys:
- explanation: Clear technical explanation of the security issue
- blast_radius: Natural language description of potential impact scope
- risk_assessment: Business risk assessment with priority level
- priority_score: Numerical priority score (1-100, higher = more urgent)
- business_impact: High/Medium/Low business impact assessment
- remediation_urgency: Immediate/High/Medium/Low urgency level
- attack_vector: How this vulnerability could be exploited
- compliance_impact: Potential compliance violations (SOC2, PCI, etc.)
```

**Expected Output Format**:
```json
{
  "explanation": "Clear technical explanation of the security issue...",
  "blast_radius": "Description of impact scope...",
  "risk_assessment": "CRITICAL RISK - Immediate action required...",
  "priority_score": 95,
  "business_impact": "High",
  "remediation_urgency": "Immediate",
  "attack_vector": "Description of how vulnerability could be exploited...",
  "compliance_impact": "Potential SOC2 and PCI DSS violations"
}
```

**Usage Example**:
When a user clicks "AI Explain" on a finding, this prompt analyzes the security issue and provides:
- Detailed technical explanation
- Blast radius analysis (scope of potential impact)
- Business risk assessment
- Priority scoring
- Attack vector analysis
- Compliance impact assessment (SOC2, PCI DSS, etc.)

**Model**: Gemini Pro/Flash  
**Temperature**: Default (typically 0.7)  
**Max Tokens**: Not explicitly set (uses Gemini defaults)

---

## Prompt 2: Scan Summary Generation

**Purpose**: Generate executive-level security summaries with compliance impact, risk overview, top concerns, and strategic recommendations.

**Endpoint**: `GET /summary/{job_id}`  
**Implementation**: `backend/main.py` lines 300-321

**Full Prompt**:
```
You are a cybersecurity expert analyzing a Google Cloud security scan. Provide a comprehensive executive summary.

Scan Results:
- Total Findings: {total_count}
- Critical: {critical_count}
- High: {high_count}
- Medium: {medium_count}
- Low: {low_count}

Key Findings:
{findings_json}

Provide analysis in JSON format with these keys:
- executive_summary: High-level overview for executives
- risk_overview: Overall risk assessment
- top_concerns: Top 3 most critical issues
- compliance_status: Compliance impact assessment
- remediation_roadmap: Phased approach to fixing issues
- business_impact: Overall business risk
- recommendations: Strategic recommendations
```

**Expected Output Format**:
```json
{
  "executive_summary": "Security scan completed with 7 findings. 4 high-priority issues require immediate attention...",
  "risk_overview": "Overall risk level: HIGH - Multiple critical vulnerabilities detected",
  "top_concerns": [
    "Payment processor exposure",
    "Excessive permissions",
    "Plain text secrets"
  ],
  "compliance_status": "SOC2 and PCI DSS violations detected",
  "remediation_roadmap": "Phase 1: Critical (1-2 days), Phase 2: High (1 week)...",
  "business_impact": "High",
  "recommendations": ["Implement least-privilege IAM", "Use Secret Manager", ...]
}
```

**Usage Example**:
Generates executive summaries that translate technical security findings into business language, helping stakeholders understand risk, compliance impact, and remediation priorities.

**Model**: Gemini Pro/Flash  
**Temperature**: Default  
**Max Tokens**: Not explicitly set

---

## Prompt 3: Fix Proposal Generation

**Purpose**: Generate production-ready Terraform code to remediate Cloud Run security findings, including implementation guides and testing recommendations.

**Endpoint**: `POST /propose/{job_id}`  
**Implementation**: `backend/main.py` lines 396-408

**Full Prompt**:
```
You are a Google Cloud security expert. Generate comprehensive fix proposals for these Cloud Run IAM findings:

{findings_summary}

Please provide:
1. A summary of all issues and their business impact
2. Terraform code to fix each issue (least-privilege principle)
3. Step-by-step implementation guide
4. Testing recommendations

Format as JSON with keys: summary, terraform_code, implementation_steps, testing_recommendations
```

**Expected Output Format**:
```json
{
  "summary": {
    "CRITICAL": "Description of critical issue and business impact...",
    "HIGH": "Description of high severity issue and business impact...",
    "MEDIUM": "Description of medium severity issue..."
  },
  "terraform_code": {
    "CRITICAL": {
      "description": "Remove unauthenticated access",
      "code": "resource \"google_cloud_run_service_iam_policy\"..."
    },
    "HIGH": {
      "description": "Implement least-privilege IAM",
      "code": "resource \"google_project_iam_member\"..."
    }
  },
  "implementation_steps": {
    "CRITICAL": [
      "Step 1: Review current IAM policy",
      "Step 2: Apply Terraform code",
      "Step 3: Verify changes"
    ]
  },
  "testing_recommendations": {
    "CRITICAL": [
      "Test unauthenticated access is rejected",
      "Perform penetration testing"
    ]
  }
}
```

**Usage Example**:
When a user clicks "AI Propose", this prompt generates:
- Complete Terraform code to fix each security issue
- Step-by-step implementation guides
- Testing recommendations for validation
- Business impact summaries

**Model**: Gemini Pro/Flash  
**Temperature**: Default  
**Max Tokens**: Not explicitly set

---

## AI Model Configuration

### Model Selection Strategy

The application implements robust model initialization with automatic fallback:

**Models Tried (in order)**:
1. `gemini-2.5-flash` - Latest, fastest, recommended
2. `gemini-2.5-pro` - Latest, most capable
3. `gemini-2.0-flash` - Stable version
4. `gemini-pro-latest` - Latest pro version
5. `gemini-flash-latest` - Latest flash version
6. `models/gemini-2.5-flash` - Full model path
7. `models/gemini-2.5-pro` - Full model path

**Implementation**: `backend/main.py` lines 60-111

### Response Parsing

All prompts include markdown code block removal:
```python
text_to_parse = response.text.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
ai_data = json.loads(text_to_parse)
```

This ensures robust parsing of AI-generated JSON, even when wrapped in markdown fences.

---

## Integration with Cloud Run

### Architecture

```
User Request (Frontend)
    ↓
Backend API (FastAPI on Cloud Run Service)
    ↓
AI Service (calls Gemini Pro via google-generativeai SDK)
    ↓
Google AI Studio / Gemini Pro
    ↓
Structured JSON Response
    ↓
Frontend Display (React/Vite)
```

### Service Integration

- **Backend Service**: Handles all AI Studio integration
- **Frontend Service**: Displays AI-generated content
- **Propose Job**: Async AI report generation (Cloud Run Job)
- **Scan Processor Job**: Collects findings for AI analysis (Cloud Run Job)

---

## Security & Privacy

- All prompts use structured input (no user data directly in prompts)
- API key stored securely in environment variables
- No sensitive data logged in AI responses
- Graceful fallback when AI is unavailable

---

## References

- **Google AI Studio**: https://aistudio.google.com/
- **Gemini Pro Documentation**: https://ai.google.dev/docs
- **Cloud Run Hackathon**: https://run.devpost.com/
- **Source Code**: https://github.com/prabhakaran-jm/zero-trust-explainer

