"""Zero-Trust Explainer API - FastAPI backend for Cloud Run."""
import os
import json
import logging
import time
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import pubsub_v1, bigquery, storage, run_v2
from google.auth.transport import requests as auth_requests
from google.auth import compute_engine
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Zero-Trust Explainer API",
    description="Human-readable IAM diffs for Cloud Run",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")
PUBSUB_TOPIC = os.environ.get("PUBSUB_TOPIC", "zte-scan-requests")
BQ_DATASET = os.environ.get("BQ_DATASET", "zero_trust_explainer")
BQ_TABLE = os.environ.get("BQ_TABLE", "findings")
REPORT_BUCKET = os.environ.get("REPORT_BUCKET", "")
PROPOSE_JOB_NAME = os.environ.get("PROPOSE_JOB_NAME", "zte-propose-job")
REGION = os.environ.get("REGION", "us-central1")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Initialize GCP clients
publisher = pubsub_v1.PublisherClient()
bq_client = bigquery.Client()
storage_client = storage.Client()

# Initialize AI Studio (Gemini) with google-generativeai SDK
gemini_model = None
if GEMINI_API_KEY:
    try:
        # Configure the API key
        genai.configure(api_key=GEMINI_API_KEY)

        # Try different model names in order of preference
        # Note: As of 2025, use the latest available models from ListModels API
        model_names_to_try = [
            "gemini-2.5-flash",           # Latest, fastest, recommended
            "gemini-2.5-pro",             # Latest, most capable
            "gemini-2.0-flash",          # Stable version
            "gemini-pro-latest",         # Latest pro version
            "gemini-flash-latest",       # Latest flash version
            "models/gemini-2.5-flash",   # Full model path
            "models/gemini-2.5-pro"      # Full model path
        ]

        for model_name in model_names_to_try:
            try:
                logger.info(f"Attempting to initialize model: {model_name}")
                test_model = genai.GenerativeModel(model_name)

                # Test with a simple prompt to verify it works
                test_response = test_model.generate_content(
                    "Say 'OK' if you can read this.",
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=10,
                        temperature=0.1
                    )
                )

                if test_response and hasattr(test_response, 'text') and test_response.text:
                    gemini_model = test_model
                    logger.info(f"✅ AI Studio initialized successfully with model: {model_name}")
                    logger.info(f"Test response: {test_response.text[:50]}")
                    break
                else:
                    logger.warning(f"Model {model_name} responded but with no text")

            except Exception as model_error:
                logger.warning(f"Model {model_name} failed: {str(model_error)[:200]}")
                continue

        if gemini_model is None:
            logger.error("❌ All AI Studio model attempts failed. AI features will be disabled.")
            logger.error("Check: 1) API key is valid, 2) API key has Generative AI API enabled, 3) Network connectivity")

    except Exception as e:
        logger.error(f"Failed to configure AI Studio: {e}")
        gemini_model = None
else:
    logger.warning("GEMINI_API_KEY not set - AI features will be disabled")


# Pydantic models
class ScanRequest(BaseModel):
    """Request model for scan endpoint."""
    service_name: str
    region: Optional[str] = None
    project_id: Optional[str] = None


class Finding(BaseModel):
    """Finding model from BigQuery."""
    id: str
    job_id: str
    severity: str
    resource_type: str
    resource_name: str
    issue_description: str
    recommendation: str
    blast_radius: Optional[str] = None
    affected_resources: Optional[str] = None
    risk_score: Optional[int] = None
    created_at: str


class ProposeRequest(BaseModel):
    """Request model for propose endpoint."""
    job_id: str
    findings_ids: Optional[List[str]] = None


# AI Service Class
class AIService:
    """AI-powered service using Gemini Pro for security analysis."""
    
    def __init__(self, model):
        self.model = model
        self.ai_enabled = model is not None
    
    def generate_explanation(self, finding: Finding) -> Dict[str, Any]:
        """Generate AI-powered explanation for a security finding."""
        if not self.ai_enabled:
            return self._generate_fallback_explanation(finding)
        
        try:
            prompt = f"""
            You are a cybersecurity expert analyzing Google Cloud security findings. Provide intelligent risk prioritization.
            
            Finding Details:
            - Resource Type: {finding.resource_type}
            - Resource Name: {finding.resource_name}
            - Severity: {finding.severity}
            - Issue: {finding.issue_description}
            - Recommendation: {finding.recommendation}
            - Risk Score: {finding.risk_score}/100
            - Affected Resources: {finding.affected_resources}
            
            Provide comprehensive analysis in JSON format with these keys:
            - explanation: Clear technical explanation of the security issue
            - blast_radius: Natural language description of potential impact scope
            - risk_assessment: Business risk assessment with priority level
            - priority_score: Numerical priority score (1-100, higher = more urgent)
            - business_impact: High/Medium/Low business impact assessment
            - remediation_urgency: Immediate/High/Medium/Low urgency level
            - attack_vector: How this vulnerability could be exploited
            - compliance_impact: Potential compliance violations (SOC2, PCI, etc.)
            """
            
            response = self.model.generate_content(prompt)
            
            # Check if response is valid
            if not response or not hasattr(response, 'text') or not response.text:
                logger.error("Empty response from Gemini API")
                return self._generate_fallback_explanation(finding)
            
            logger.info(f"Gemini response: {response.text[:200]}...")
            
            # Try to parse JSON response, fallback to text
            try:
                # Remove markdown code blocks if present
                text_to_parse = response.text.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
                ai_data = json.loads(text_to_parse)
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parsing failed: {e}, using text response")
                ai_data = {
                    "explanation": response.text,
                    "blast_radius": "See explanation above",
                    "risk_assessment": "Review the detailed explanation"
                }
            
            # Calculate priority score from severity if risk_score not available
            priority_score = ai_data.get("priority_score", finding.risk_score if finding.risk_score else {
                "CRITICAL": 95, "HIGH": 75, "MEDIUM": 50, "LOW": 25
            }.get(finding.severity, 50))
            
            return {
                "ai_explanation": ai_data.get("explanation", response.text),
                "blast_radius": ai_data.get("blast_radius", "Analysis in progress"),
                "risk_assessment": ai_data.get("risk_assessment", "Manual review recommended"),
                "priority_score": priority_score,
                "business_impact": ai_data.get("business_impact", "Medium"),
                "remediation_urgency": ai_data.get("remediation_urgency", "Medium"),
                "attack_vector": ai_data.get("attack_vector", "Manual analysis required"),
                "compliance_impact": ai_data.get("compliance_impact", "Review required"),
                "ai_model": "gemini-2.0-flash",
                "ai_powered": True
            }
            
        except Exception as e:
            logger.error(f"AI explanation generation failed: {e}")
            return self._generate_fallback_explanation(finding)
    
    def _generate_fallback_explanation(self, finding: Finding) -> Dict[str, Any]:
        """Generate fallback explanation when AI is not available."""
        # Generate contextual explanations based on finding type
        explanations = {
            "Cloud Run Service": {
                "CRITICAL": f"This is a critical security vulnerability in your {finding.resource_name} service. The issue '{finding.issue_description}' means that your service is exposed to significant security risks. This could allow unauthorized access to your application, potentially leading to data breaches, service abuse, or complete system compromise.",
                "HIGH": f"This is a high-severity security issue in your {finding.resource_name} service. The problem '{finding.issue_description}' creates substantial security risks that could impact your application's integrity and availability.",
                "MEDIUM": f"This is a medium-severity security concern in your {finding.resource_name} service. The issue '{finding.issue_description}' should be addressed to maintain proper security posture.",
                "LOW": f"This is a low-severity security observation in your {finding.resource_name} service. The issue '{finding.issue_description}' represents a minor security consideration."
            },
            "Service Account": {
                "CRITICAL": f"This is a critical service account configuration issue. The problem '{finding.issue_description}' means your service account has excessive permissions that violate the principle of least privilege. This could allow an attacker to gain full access to your project if the service account credentials are compromised.",
                "HIGH": f"This is a high-severity service account issue. The problem '{finding.issue_description}' creates significant security risks by granting more permissions than necessary.",
                "MEDIUM": f"This is a medium-severity service account configuration issue. The problem '{finding.issue_description}' should be reviewed and corrected.",
                "LOW": f"This is a low-severity service account observation. The issue '{finding.issue_description}' represents a minor configuration consideration."
            }
        }
        
        blast_radius_explanations = {
            "CRITICAL": "If exploited, this vulnerability could affect your entire application infrastructure, leading to data breaches, service disruption, and potential compliance violations.",
            "HIGH": "If exploited, this issue could impact multiple services and resources, potentially causing service failures and security incidents.",
            "MEDIUM": "If exploited, this issue could affect specific functionality and may impact service reliability.",
            "LOW": "If exploited, this issue would have minimal impact on your overall system security."
        }
        
        risk_assessments = {
            "CRITICAL": "CRITICAL RISK - Immediate action required. This vulnerability poses significant business risk including potential data breaches, regulatory violations, and reputational damage.",
            "HIGH": "HIGH RISK - Urgent attention needed. This issue could lead to service disruptions, security incidents, and operational impact.",
            "MEDIUM": "MEDIUM RISK - Should be addressed in the next maintenance window. This issue may impact service reliability and security posture.",
            "LOW": "LOW RISK - Can be addressed during regular maintenance. This issue represents a minor security consideration."
        }
        
        resource_type = finding.resource_type
        severity = finding.severity
        
        explanation = explanations.get(resource_type, {}).get(severity, f"This {severity} severity issue in {resource_type} requires attention: {finding.issue_description}")
        blast_radius = blast_radius_explanations.get(severity, "Impact assessment requires manual review.")
        risk_assessment = risk_assessments.get(severity, "Risk level requires manual assessment.")
        
        # Calculate priority score from severity if risk_score not available
        priority_score = finding.risk_score if finding.risk_score else {
            "CRITICAL": 95, "HIGH": 75, "MEDIUM": 50, "LOW": 25
        }.get(severity, 50)
        
        return {
            "ai_explanation": explanation,
            "blast_radius": blast_radius,
            "risk_assessment": risk_assessment,
            "priority_score": priority_score,
            "business_impact": "High" if severity in ["CRITICAL", "HIGH"] else "Medium" if severity == "MEDIUM" else "Low",
            "remediation_urgency": "Immediate" if severity == "CRITICAL" else "High" if severity == "HIGH" else "Medium" if severity == "MEDIUM" else "Low",
            "attack_vector": "Manual analysis required",
            "compliance_impact": "Review required",
            "ai_model": "fallback-analysis",
            "ai_powered": False
        }
    
    def generate_scan_summary(self, findings: List[Finding]) -> Dict[str, Any]:
        """Generate AI-powered summary of scan results."""
        if not self.ai_enabled:
            return self._generate_fallback_summary(findings)
        
        try:
            # Prepare findings data for AI analysis
            findings_data = []
            severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
            
            for finding in findings:
                severity_counts[finding.severity] += 1
                findings_data.append({
                    "severity": finding.severity,
                    "resource_type": finding.resource_type,
                    "resource_name": finding.resource_name,
                    "issue": finding.issue_description,
                    "risk_score": finding.risk_score
                })
            
            prompt = f"""
            You are a cybersecurity expert analyzing a Google Cloud security scan. Provide a comprehensive executive summary.
            
            Scan Results:
            - Total Findings: {len(findings)}
            - Critical: {severity_counts['CRITICAL']}
            - High: {severity_counts['HIGH']}
            - Medium: {severity_counts['MEDIUM']}
            - Low: {severity_counts['LOW']}
            
            Key Findings:
            {json.dumps(findings_data[:10], indent=2)}  # Limit to first 10 for prompt size
            
            Provide analysis in JSON format with these keys:
            - executive_summary: High-level overview for executives
            - risk_overview: Overall risk assessment
            - top_concerns: Top 3 most critical issues
            - compliance_status: Compliance impact assessment
            - remediation_roadmap: Phased approach to fixing issues
            - business_impact: Overall business risk
            - recommendations: Strategic recommendations
            """
            
            response = self.model.generate_content(prompt)
            
            if not response or not hasattr(response, 'text') or not response.text:
                logger.error("Empty response from Gemini API for summary")
                return self._generate_fallback_summary(findings)
            
            try:
                ai_data = json.loads(response.text)
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parsing failed for summary: {e}")
                ai_data = {
                    "executive_summary": response.text,
                    "risk_overview": "Manual review required",
                    "top_concerns": ["Review all findings manually"],
                    "compliance_status": "Assessment required",
                    "remediation_roadmap": "Manual planning needed",
                    "business_impact": "Medium",
                    "recommendations": ["Conduct manual security review"]
                }
            
            return {
                "executive_summary": ai_data.get("executive_summary", "Summary generation failed"),
                "risk_overview": ai_data.get("risk_overview", "Manual assessment required"),
                "top_concerns": ai_data.get("top_concerns", []),
                "compliance_status": ai_data.get("compliance_status", "Review required"),
                "remediation_roadmap": ai_data.get("remediation_roadmap", "Manual planning needed"),
                "business_impact": ai_data.get("business_impact", "Medium"),
                "recommendations": ai_data.get("recommendations", []),
                "severity_counts": severity_counts,
                "ai_model": "gemini-2.0-flash",
                "ai_powered": True
            }
            
        except Exception as e:
            logger.error(f"AI summary generation failed: {e}")
            return self._generate_fallback_summary(findings)
    
    def _generate_fallback_summary(self, findings: List[Finding]) -> Dict[str, Any]:
        """Generate fallback summary when AI is not available."""
        severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        
        for finding in findings:
            severity_counts[finding.severity] += 1
        
        total_critical_high = severity_counts["CRITICAL"] + severity_counts["HIGH"]
        
        return {
            "executive_summary": f"Security scan completed with {len(findings)} findings. {total_critical_high} high-priority issues require immediate attention.",
            "risk_overview": f"Overall risk level: {'HIGH' if total_critical_high > 5 else 'MEDIUM' if total_critical_high > 0 else 'LOW'}",
            "top_concerns": [f"{severity_counts['CRITICAL']} critical issues", f"{severity_counts['HIGH']} high-severity issues"],
            "compliance_status": "Manual compliance review required",
            "remediation_roadmap": "Phase 1: Critical issues, Phase 2: High issues, Phase 3: Medium/Low issues",
            "business_impact": "High" if total_critical_high > 5 else "Medium" if total_critical_high > 0 else "Low",
            "recommendations": ["Address critical issues immediately", "Implement security best practices", "Regular security scanning"],
            "severity_counts": severity_counts,
            "ai_model": "fallback-analysis",
            "ai_powered": False
        }
    
    def generate_fix_proposal(self, findings: List[Finding]) -> Dict[str, Any]:
        if not self.ai_enabled:
            return {
                "ai_proposal": "AI features disabled - API key not configured",
                "terraform_code": "# AI-generated fixes unavailable",
                "implementation_steps": ["Manual review required"]
            }
        
        try:
            findings_summary = "\n".join([
                f"- {f.severity.upper()}: {f.resource_type} ({f.resource_name}): {f.issue_description}"
                for f in findings
            ])
            
            prompt = f"""
            You are a Google Cloud security expert. Generate comprehensive fix proposals for these Cloud Run IAM findings:
            
            {findings_summary}
            
            Please provide:
            1. A summary of all issues and their business impact
            2. Terraform code to fix each issue (least-privilege principle)
            3. Step-by-step implementation guide
            4. Testing recommendations
            
            Format as JSON with keys: summary, terraform_code, implementation_steps, testing_recommendations
            """
            
            response = self.model.generate_content(prompt)
            
            try:
                # Remove markdown code blocks if present
                text_to_parse = response.text.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
                ai_data = json.loads(text_to_parse)
                
                # Return the structured data directly
                return {
                    "ai_proposal": ai_data.get("summary", response.text),
                    "terraform_code": ai_data.get("terraform_code", "# AI-generated fixes"),
                    "implementation_steps": ai_data.get("implementation_steps", ["Manual review required"]),
                    "testing_recommendations": ai_data.get("testing_recommendations", ["Test thoroughly"]),
                    "ai_model": "gemini-pro",
                    "ai_powered": True
                }
            except json.JSONDecodeError:
                ai_data = {
                    "summary": response.text,
                    "terraform_code": "# Generated fixes - see summary above",
                    "implementation_steps": ["Review the detailed summary"],
                    "testing_recommendations": ["Test all changes in development first"]
                }
                return {
                    "ai_proposal": ai_data.get("summary", response.text),
                    "terraform_code": ai_data.get("terraform_code", "# AI-generated fixes"),
                    "implementation_steps": ai_data.get("implementation_steps", ["Manual review required"]),
                    "testing_recommendations": ai_data.get("testing_recommendations", ["Test thoroughly"]),
                    "ai_model": "gemini-pro",
                    "ai_powered": True
                }
            
        except Exception as e:
            logger.error(f"AI fix proposal generation failed: {e}")
            return {
                "ai_proposal": f"AI analysis temporarily unavailable: {str(e)}",
                "terraform_code": "# Manual review required",
                "implementation_steps": ["Review findings manually"],
                "ai_powered": False
            }


# Initialize AI service
ai_service = AIService(gemini_model)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "Zero-Trust Explainer API",
        "version": "1.0.0",
        "ai_studio": {
            "enabled": ai_service.ai_enabled,
            "model": "gemini-pro" if ai_service.ai_enabled else None,
            "features": ["explanations", "fix_proposals", "blast_radius_analysis"]
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/scan")
async def scan(request: ScanRequest):
    """
    Publish a scan request to Pub/Sub.
    
    Args:
        request: ScanRequest with service details
        
    Returns:
        job_id and status
    """
    try:
        job_id = str(uuid4())
        
        # Prepare message
        message_data = {
            "job_id": job_id,
            "service_name": request.service_name,
            "region": request.region or REGION,
            "project_id": request.project_id or PROJECT_ID,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Publish to Pub/Sub
        topic_path = publisher.topic_path(PROJECT_ID, PUBSUB_TOPIC)
        message_bytes = json.dumps(message_data).encode("utf-8")
        
        future = publisher.publish(topic_path, message_bytes)
        message_id = future.result()
        
        logger.info(f"Published scan request with job_id={job_id}, message_id={message_id}")
        
        # Trigger scan processor job automatically
        try:
            import requests
            from google.auth.transport.requests import Request
            from google.auth import default
            
            # Get access token for API calls
            credentials, project = default()
            credentials.refresh(Request())
            access_token = credentials.token
            
            # Build the REST API URL for scan processor job
            job_name = f"projects/{PROJECT_ID}/locations/{REGION}/jobs/zte-scan-processor"
            api_url = f"https://{REGION}-run.googleapis.com/v2/{job_name}:run"
            
            # Prepare the request payload with environment variables
            payload = {
                "overrides": {
                    "containerOverrides": [
                        {
                            "env": [
                                {"name": "JOB_ID", "value": job_id},
                                {"name": "SERVICE_NAME", "value": request.service_name},
                                {"name": "REGION", "value": request.region or REGION},
                                {"name": "PROJECT_ID", "value": request.project_id or PROJECT_ID},
                            ]
                        }
                    ]
                }
            }
            
            # Make the API call
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            logger.info(f"Triggering scan processor job via REST API: {api_url}")
            response = requests.post(api_url, json=payload, headers=headers)
            
            if response.status_code == 200:
                logger.info(f"Successfully triggered scan processor job for job_id={job_id}")
            else:
                logger.warning(f"Failed to trigger scan processor job: {response.status_code} - {response.text}")
                # Continue anyway - scan was published to Pub/Sub
        
        except Exception as job_error:
            logger.warning(f"Failed to trigger scan processor job: {job_error}")
            # Continue anyway - scan was published to Pub/Sub
        
        return {
            "job_id": job_id,
            "status": "queued",
            "message": f"Scan request published successfully",
            "pubsub_message_id": message_id
        }
    except Exception as e:
        logger.error(f"Error publishing scan request: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to publish scan request: {str(e)}")


@app.get("/findings/{job_id}")
async def get_findings(
    job_id: str,
    severity: Optional[str] = None,
    limit: int = 100
):
    """
    Retrieve findings for a specific job from BigQuery.
    
    Args:
        job_id: The job identifier
        severity: Optional severity filter (critical, high, medium, low)
        limit: Maximum number of findings to return
        
    Returns:
        List of findings
    """
    try:
        # Build query
        query = f"""
        SELECT 
            id,
            job_id,
            severity,
            resource_type,
            resource_name,
            issue_description,
            recommendation,
            TIMESTAMP_TRUNC(created_at, SECOND) as created_at
        FROM `{PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}`
        WHERE job_id = @job_id
        """
        
        if severity:
            query += " AND LOWER(severity) = LOWER(@severity)"
        
        query += f" ORDER BY created_at DESC LIMIT {limit}"
        
        # Configure query parameters
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("job_id", "STRING", job_id),
            ]
        )
        
        if severity:
            job_config.query_parameters.append(
                bigquery.ScalarQueryParameter("severity", "STRING", severity)
            )
        
        # Execute query
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        # Format results
        findings = []
        for row in results:
            findings.append({
                "id": row.id,
                "job_id": row.job_id,
                "severity": row.severity,
                "resource_type": row.resource_type,
                "resource_name": row.resource_name,
                "issue_description": row.issue_description,
                "recommendation": row.recommendation,
                "created_at": row.created_at.isoformat() if row.created_at else None
            })
        
        logger.info(f"Retrieved {len(findings)} findings for job_id={job_id}")
        
        return {
            "job_id": job_id,
            "count": len(findings),
            "findings": findings
        }
    except Exception as e:
        logger.error(f"Error retrieving findings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve findings: {str(e)}")


@app.get("/explain/{finding_id}")
async def explain_finding(finding_id: str):
    """
    Get detailed explanation for a specific finding.
    
    Args:
        finding_id: The finding identifier
        
    Returns:
        Detailed explanation with blast radius analysis
    """
    try:
        # Query BigQuery for the specific finding
        query = f"""
        SELECT 
            id,
            job_id,
            severity,
            resource_type,
            resource_name,
            issue_description,
            recommendation,
            blast_radius,
            affected_resources,
            risk_score,
            created_at
        FROM `{PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}`
        WHERE id = @finding_id
        LIMIT 1
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("finding_id", "STRING", finding_id),
            ]
        )
        
        query_job = bq_client.query(query, job_config=job_config)
        results = query_job.result()
        
        # Check if finding exists
        row = next(results, None)
        if not row:
            raise HTTPException(status_code=404, detail=f"Finding {finding_id} not found")
        
        # Create Finding object for AI service
        finding = Finding(
            id=row.id,
            job_id=row.job_id,
            severity=row.severity,
            resource_type=row.resource_type,
            resource_name=row.resource_name,
            issue_description=row.issue_description,
            recommendation=row.recommendation,
            created_at=row.created_at.isoformat() if row.created_at else None
        )
        
        # Generate AI-powered explanation
        ai_analysis = ai_service.generate_explanation(finding)
        
        # Build comprehensive explanation with AI analysis
        explanation = {
            "id": row.id,
            "job_id": row.job_id,
            "severity": row.severity,
            "resource_type": row.resource_type,
            "resource_name": row.resource_name,
            "issue_description": row.issue_description,
            "recommendation": row.recommendation,
            "blast_radius": ai_analysis.get("blast_radius", "Limited to service scope"),
            "ai_explanation": ai_analysis.get("ai_explanation", f"This {row.severity} severity issue affects {row.resource_name}. {row.issue_description} To mitigate, {row.recommendation}"),
            "risk_assessment": ai_analysis.get("risk_assessment", "Manual review recommended"),
            "priority_score": ai_analysis.get("priority_score"),
            "business_impact": ai_analysis.get("business_impact"),
            "remediation_urgency": ai_analysis.get("remediation_urgency"),
            "attack_vector": ai_analysis.get("attack_vector"),
            "compliance_impact": ai_analysis.get("compliance_impact"),
            "ai_powered": ai_analysis.get("ai_powered", False),
            "ai_model": ai_analysis.get("ai_model", None),
            "created_at": row.created_at.isoformat() if row.created_at else None
        }
        
        logger.info(f"Generated explanation for finding_id={finding_id}")
        
        return explanation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating explanation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate explanation: {str(e)}")


@app.post("/propose/{job_id}")
async def propose_fixes(job_id: str, request: Optional[ProposeRequest] = None):
    """
    Trigger Cloud Run Job to propose least-privilege fixes.
    
    Args:
        job_id: The job identifier
        request: Optional ProposeRequest with specific finding IDs
        
    Returns:
        Job execution details
    """
    try:
        # First, get findings for this job to generate AI proposals
        findings_query = f"""
        SELECT 
            id,
            job_id,
            severity,
            resource_type,
            resource_name,
            issue_description,
            recommendation,
            created_at
        FROM `{PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}`
        WHERE job_id = @job_id
        """
        
        if request and request.findings_ids:
            findings_query += " AND id IN UNNEST(@finding_ids)"
        
        findings_query += " ORDER BY severity DESC"
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("job_id", "STRING", job_id),
            ]
        )
        
        if request and request.findings_ids:
            job_config.query_parameters.append(
                bigquery.ArrayQueryParameter("finding_ids", "STRING", request.findings_ids)
            )
        
        findings_job = bq_client.query(findings_query, job_config=job_config)
        findings_results = findings_job.result()
        
        # Convert to Finding objects
        findings = []
        for row in findings_results:
            findings.append(Finding(
                id=row.id,
                job_id=row.job_id,
                severity=row.severity,
                resource_type=row.resource_type,
                resource_name=row.resource_name,
                issue_description=row.issue_description,
                recommendation=row.recommendation,
                created_at=row.created_at.isoformat() if row.created_at else None
            ))
        
        # Generate AI-powered fix proposals
        ai_proposals = ai_service.generate_fix_proposal(findings)
        
        # Prepare job execution request
        execution_data = {
            "job_id": job_id,
            "timestamp": datetime.utcnow().isoformat(),
            "ai_proposals": ai_proposals
        }
        
        if request and request.findings_ids:
            execution_data["findings_ids"] = request.findings_ids
        
        # Use REST API to trigger Cloud Run Job (works with Compute Engine credentials)
        import requests
        from google.auth.transport.requests import Request
        from google.auth import default
        
        # Get access token for API calls
        credentials, project = default()
        credentials.refresh(Request())
        access_token = credentials.token
        
        # Build the REST API URL
        job_name = f"projects/{PROJECT_ID}/locations/{REGION}/jobs/{PROPOSE_JOB_NAME}"
        api_url = f"https://{REGION}-run.googleapis.com/v2/{job_name}:run"
        
        # Prepare the request payload
        payload = {
            "overrides": {
                "containerOverrides": [
                    {
                        "env": [
                            {"name": "GCP_PROJECT_ID", "value": PROJECT_ID},
                            {"name": "JOB_ID", "value": job_id},
                            {"name": "EXECUTION_DATA", "value": json.dumps(execution_data)}
                        ]
                    }
                ]
            }
        }
        
        # Make the API call
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"Triggering Cloud Run Job via REST API: {api_url}")
        response = requests.post(api_url, json=payload, headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"Cloud Run Job API call failed: {response.status_code} - {response.text}")
        
        result = response.json()
        execution_name = result.get("name", f"execution-{job_id}-{int(time.time())}")
        
        logger.info(f"Triggered propose job for job_id={job_id}, execution={execution_name}")
        
        # If REPORT_BUCKET is set, generate signed URL using IAM signing
        report_url = None
        if REPORT_BUCKET:
            try:
                blob_name = f"proposals/{job_id}/report.json"
                blob = storage_client.bucket(REPORT_BUCKET).blob(blob_name)

                # Get service account email for signing
                service_account_email = os.environ.get("SERVICE_ACCOUNT_EMAIL")
                if not service_account_email:
                    service_account_email = f"zte-service-account@{PROJECT_ID}.iam.gserviceaccount.com"

                logger.info(f"Generating signed URL using service account: {service_account_email}")

                # Use IAM-based signing (requires iam.serviceAccountTokenCreator role)
                signing_credentials = compute_engine.IDTokenCredentials(
                    auth_requests.Request(),
                    "",
                    service_account_email=service_account_email
                )

                # Generate signed URL with IAM signing
                report_url = blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(hours=1),
                    method="GET",
                    service_account_email=service_account_email
                )

                logger.info(f"Signed URL generated successfully")
            except Exception as url_error:
                # Log the error but don't fail the entire request
                logger.warning(f"Failed to generate signed URL: {url_error}. The report will still be generated.")
                # Return a GCS path as fallback
                report_url = f"gs://{REPORT_BUCKET}/proposals/{job_id}/report.json"
        
        return {
            "job_id": job_id,
            "status": "triggered",
            "execution_name": execution_name,
            "report_url": report_url,
            "message": "Propose job triggered successfully",
            "ai_proposals": ai_proposals,
            "ai_powered": ai_proposals.get("ai_powered", False),
            "ai_model": ai_proposals.get("ai_model", None)
        }
    except Exception as e:
        logger.error(f"Error triggering propose job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger propose job: {str(e)}")


@app.get("/summary/{job_id}")
async def get_ai_summary(job_id: str):
    """
    Generate AI-powered summary of scan results.
    
    Args:
        job_id: The job identifier
        
    Returns:
        AI-generated summary with insights and recommendations
    """
    try:
        # Get findings for the job
        findings = await get_findings(job_id)
        
        if not findings:
            raise HTTPException(status_code=404, detail=f"No findings found for job {job_id}")
        
        # Generate AI summary
        summary = ai_service.generate_scan_summary(findings)
        
        return {
            "job_id": job_id,
            "summary": summary,
            "total_findings": len(findings),
            "ai_powered": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating AI summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate AI summary: {str(e)}")


@app.get("/jobs")
async def list_jobs(limit: int = 50):
    """
    List recent scan jobs from BigQuery.
    
    Args:
        limit: Maximum number of jobs to return
        
    Returns:
        List of jobs with summary statistics
    """
    try:
        query = f"""
        SELECT 
            job_id,
            COUNT(*) as finding_count,
            COUNTIF(LOWER(severity) = 'critical') as critical_count,
            COUNTIF(LOWER(severity) = 'high') as high_count,
            COUNTIF(LOWER(severity) = 'medium') as medium_count,
            COUNTIF(LOWER(severity) = 'low') as low_count,
            MIN(created_at) as first_finding_at,
            MAX(created_at) as last_finding_at
        FROM `{PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}`
        GROUP BY job_id
        ORDER BY first_finding_at DESC
        LIMIT {limit}
        """
        
        query_job = bq_client.query(query)
        results = query_job.result()
        
        jobs = []
        for row in results:
            jobs.append({
                "job_id": row.job_id,
                "finding_count": row.finding_count,
                "severity_counts": {
                    "critical": row.critical_count,
                    "high": row.high_count,
                    "medium": row.medium_count,
                    "low": row.low_count
                },
                "first_finding_at": row.first_finding_at.isoformat() if row.first_finding_at else None,
                "last_finding_at": row.last_finding_at.isoformat() if row.last_finding_at else None
            })
        
        logger.info(f"Retrieved {len(jobs)} jobs")
        
        return {
            "count": len(jobs),
            "jobs": jobs
        }
    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
