"""Zero-Trust Explainer API - FastAPI backend for Cloud Run."""
import os
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from google.cloud import pubsub_v1, bigquery, storage, run_v2
from google.oauth2 import service_account

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

# Initialize GCP clients
publisher = pubsub_v1.PublisherClient()
bq_client = bigquery.Client()
storage_client = storage.Client()


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
    created_at: str


class ProposeRequest(BaseModel):
    """Request model for propose endpoint."""
    job_id: str
    findings_ids: Optional[List[str]] = None


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "Zero-Trust Explainer API",
        "version": "1.0.0"
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
        
        # Build explanation
        explanation = {
            "id": row.id,
            "job_id": row.job_id,
            "severity": row.severity,
            "resource_type": row.resource_type,
            "resource_name": row.resource_name,
            "issue_description": row.issue_description,
            "recommendation": row.recommendation,
            "blast_radius": {
                "description": row.blast_radius if hasattr(row, 'blast_radius') else "Limited to service scope",
                "affected_resources": json.loads(row.affected_resources) if hasattr(row, 'affected_resources') and row.affected_resources else [],
                "risk_score": row.risk_score if hasattr(row, 'risk_score') else 0
            },
            "explanation": f"This {row.severity} severity issue affects {row.resource_name}. "
                          f"{row.issue_description} To mitigate, {row.recommendation}",
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
        # Prepare job execution request
        execution_data = {
            "job_id": job_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if request and request.findings_ids:
            execution_data["findings_ids"] = request.findings_ids
        
        # Create Cloud Run Job client
        client = run_v2.JobsClient()
        
        # Build job name
        job_name = f"projects/{PROJECT_ID}/locations/{REGION}/jobs/{PROPOSE_JOB_NAME}"
        
        # Create execution request
        execution_request = run_v2.RunJobRequest(
            name=job_name,
            overrides=run_v2.RunJobRequest.Overrides(
                container_overrides=[
                    run_v2.RunJobRequest.Overrides.ContainerOverride(
                        env=[
                            run_v2.EnvVar(name="JOB_ID", value=job_id),
                            run_v2.EnvVar(name="EXECUTION_DATA", value=json.dumps(execution_data))
                        ]
                    )
                ]
            )
        )
        
        # Execute job
        operation = client.run_job(request=execution_request)
        
        # Get execution name from operation
        execution_name = operation.name
        
        logger.info(f"Triggered propose job for job_id={job_id}, execution={execution_name}")
        
        # If REPORT_BUCKET is set, generate signed URL for report
        report_url = None
        if REPORT_BUCKET:
            blob_name = f"proposals/{job_id}/report.json"
            blob = storage_client.bucket(REPORT_BUCKET).blob(blob_name)
            
            # Generate signed URL (valid for 1 hour)
            report_url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(hours=1),
                method="GET"
            )
        
        return {
            "job_id": job_id,
            "status": "triggered",
            "execution_name": execution_name,
            "report_url": report_url,
            "message": "Propose job triggered successfully"
        }
    except Exception as e:
        logger.error(f"Error triggering propose job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger propose job: {str(e)}")


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
