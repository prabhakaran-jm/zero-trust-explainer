#!/usr/bin/env python3
"""
Cloud Run Job script for generating AI-powered security fix proposals.
This script processes findings and generates comprehensive remediation reports.
"""

import os
import json
import logging
from datetime import datetime
from google.cloud import bigquery, storage
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
BQ_DATASET = os.environ.get("BQ_DATASET")
BQ_TABLE = os.environ.get("BQ_TABLE")
REPORT_BUCKET = os.environ.get("REPORT_BUCKET")
JOB_ID = os.environ.get("JOB_ID")
EXECUTION_DATA = os.environ.get("EXECUTION_DATA")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Initialize clients
bq_client = bigquery.Client()
storage_client = storage.Client()

# Initialize AI Studio
gemini_model = None
ai_enabled = False
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
                    ai_enabled = True
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
            ai_enabled = False

    except Exception as e:
        logger.error(f"Failed to initialize AI Studio: {e}")
        gemini_model = None
        ai_enabled = False
else:
    logger.warning("GEMINI_API_KEY not set - AI features disabled")
    gemini_model = None
    ai_enabled = False

def get_findings_for_job(job_id: str):
    """Retrieve findings for the specified job."""
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
    WHERE job_id = @job_id
    ORDER BY 
        CASE severity 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            WHEN 'LOW' THEN 4 
        END,
        risk_score DESC
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("job_id", "STRING", job_id),
        ]
    )
    
    query_job = bq_client.query(query, job_config=job_config)
    results = query_job.result()
    
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
            "blast_radius": row.blast_radius,
            "affected_resources": row.affected_resources.split(", ") if row.affected_resources else [],
            "risk_score": row.risk_score,
            "created_at": row.created_at.isoformat()
        })
    
    return findings

def generate_ai_proposals(findings):
    """Generate AI-powered fix proposals."""
    if not ai_enabled:
        return {
            "ai_proposal": "AI features disabled - API key not configured",
            "terraform_code": "# AI-generated fixes unavailable",
            "implementation_steps": ["Manual review required"],
            "testing_recommendations": ["Test all changes manually"],
            "ai_powered": False
        }
    
    try:
        findings_summary = "\n".join([
            f"- {f['severity'].upper()}: {f['resource_type']} ({f['resource_name']}): {f['issue_description']}"
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
        
        response = gemini_model.generate_content(prompt)
        
        try:
            # Remove markdown code blocks if present
            text_to_parse = response.text.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
            ai_data = json.loads(text_to_parse)
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
            "ai_model": gemini_model.model_name if hasattr(gemini_model, 'model_name') else "gemini-model",
            "ai_powered": True
        }
        
    except Exception as e:
        logger.error(f"AI fix proposal generation failed: {e}")
        return {
            "ai_proposal": f"AI analysis temporarily unavailable: {str(e)}",
            "terraform_code": "# Manual review required",
            "implementation_steps": ["Review findings manually"],
            "testing_recommendations": ["Test manually"],
            "ai_powered": False
        }

def generate_report(job_id: str, findings: list, ai_proposals: dict):
    """Generate comprehensive remediation report."""
    report = {
        "job_id": job_id,
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_findings": len(findings),
            "severity_counts": {},
            "ai_powered": ai_proposals.get("ai_powered", False),
            "ai_model": ai_proposals.get("ai_model", None)
        },
        "findings": findings,
        "ai_proposals": ai_proposals,
        "recommendations": {
            "priority_order": ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
            "implementation_phases": [
                "Phase 1: Critical and High severity issues",
                "Phase 2: Medium severity issues", 
                "Phase 3: Low severity issues and cleanup"
            ]
        }
    }
    
    # Calculate severity counts
    for finding in findings:
        severity = finding["severity"]
        report["summary"]["severity_counts"][severity] = report["summary"]["severity_counts"].get(severity, 0) + 1
    
    return report

def upload_report(report: dict, job_id: str):
    """Upload report to Cloud Storage."""
    if not REPORT_BUCKET:
        logger.warning("REPORT_BUCKET not configured - skipping upload")
        return None
    
    try:
        blob_name = f"proposals/{job_id}/report.json"
        blob = storage_client.bucket(REPORT_BUCKET).blob(blob_name)
        
        # Upload the report
        blob.upload_from_string(
            json.dumps(report, indent=2),
            content_type="application/json"
        )
        
        logger.info(f"Report uploaded to gs://{REPORT_BUCKET}/{blob_name}")
        return f"gs://{REPORT_BUCKET}/{blob_name}"
        
    except Exception as e:
        logger.error(f"Failed to upload report: {e}")
        return None

def main():
    """Main job execution function."""
    logger.info(f"Starting propose job for job_id={JOB_ID}")
    
    try:
        # Parse execution data if provided
        execution_data = {}
        if EXECUTION_DATA:
            try:
                execution_data = json.loads(EXECUTION_DATA)
                logger.info(f"Execution data: {execution_data}")
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse execution data: {e}")
        
        # Get findings for the job
        logger.info(f"Retrieving findings for job_id={JOB_ID}")
        findings = get_findings_for_job(JOB_ID)
        logger.info(f"Retrieved {len(findings)} findings")
        
        if not findings:
            logger.warning(f"No findings found for job_id={JOB_ID}")
            return
        
        # Generate AI proposals
        logger.info("Generating AI-powered proposals")
        ai_proposals = generate_ai_proposals(findings)
        
        # Generate comprehensive report
        logger.info("Generating remediation report")
        report = generate_report(JOB_ID, findings, ai_proposals)
        
        # Upload report to Cloud Storage
        logger.info("Uploading report to Cloud Storage")
        report_url = upload_report(report, JOB_ID)
        
        logger.info(f"Propose job completed successfully for job_id={JOB_ID}")
        if report_url:
            logger.info(f"Report available at: {report_url}")
        
    except Exception as e:
        logger.error(f"Propose job failed: {e}")
        raise

if __name__ == "__main__":
    main()
