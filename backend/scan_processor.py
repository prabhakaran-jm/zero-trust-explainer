#!/usr/bin/env python3
"""
Cloud Run IAM Security Scanner - Processes scan requests from Pub/Sub
and writes security findings to BigQuery.
"""

import os
import json
import logging
import traceback
from datetime import datetime
from google.cloud import pubsub_v1, bigquery, run_v2
from google.iam.v1 import iam_policy_pb2
from google.iam.v1.policy_pb2 import Binding
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
PUBSUB_SUBSCRIPTION = os.environ.get("PUBSUB_SUBSCRIPTION", "zte-scan-requests-sub")

# Initialize clients
subscriber = pubsub_v1.SubscriberClient()
bq_client = bigquery.Client()
run_client = run_v2.ServicesClient()


def analyze_iam_binding(resource_name: str, binding, findings: list):
    """Analyze a single IAM binding for security issues.
    
    Args:
        binding: A google.iam.v1.policy_pb2.Binding protobuf object
    """
    role = binding.role
    members = list(binding.members)
    
    # Critical: Check for unauthenticated access
    if "allUsers" in members or "allAuthenticatedUsers" in members:
        findings.append({
            "severity": "CRITICAL",
            "issue": f"Service allows unauthenticated access",
            "recommendation": "Remove allUsers/allAuthenticatedUsers from IAM policy. Restrict to specific service accounts or users.",
            "risk_score": 95
        })
    
    # High: Check for overly permissive roles
    if "roles/owner" in role or "roles/editor" in role:
        findings.append({
            "severity": "HIGH",
            "issue": f"Service has {role} permission (excessive privileges)",
            "recommendation": "Use least-privilege IAM roles. Replace with specific roles needed by the service.",
            "risk_score": 85
        })
    
    # Medium: Check for broad access patterns
    if "roles/viewer" in role and len(members) > 10:
        findings.append({
            "severity": "MEDIUM",
            "issue": f"Service has {role} permission with {len(members)} members",
            "recommendation": "Review and restrict access to necessary members only.",
            "risk_score": 60
        })


def scan_cloud_run_service(service_name: str, region: str, project_id: str):
    """Scan a single Cloud Run service for security issues."""
    findings = []
    
    try:
        # Construct service path
        parent = f"projects/{project_id}/locations/{region}"
        service_path = f"{parent}/services/{service_name}"
        
        # Get the service
        service = run_client.get_service(name=service_path)
        
        # Get IAM policy
        request = iam_policy_pb2.GetIamPolicyRequest(
            resource=service_path
        )
        policy = run_client.get_iam_policy(request=request)
        
        # Analyze IAM bindings
        for binding in policy.bindings:
            analyze_iam_binding(service_name, binding, findings)
        
        # Check for other security issues
        # Check if service has VPC connector configured
        if hasattr(service.template, 'vpc_access') and service.template.vpc_access:
            pass  # Good - VPC connector configured
        else:
            findings.append({
                "severity": "MEDIUM",
                "issue": "Service has no VPC connector configured",
                "recommendation": "Configure VPC connector for private network access to databases and other internal services",
                "risk_score": 55
            })
        
        # Check timeout configuration
        if hasattr(service.template, 'timeout') and service.template.timeout:
            timeout_seconds = service.template.timeout.total_seconds()
            if timeout_seconds > 300:  # More than 5 minutes
                findings.append({
                    "severity": "MEDIUM",
                    "issue": f"Service has long timeout ({timeout_seconds}s)",
                    "recommendation": "Configure appropriate timeout (typically 60-300s) to prevent DoS attacks",
                    "risk_score": 50
                })
        
        # Check for environment variable exposure
        if hasattr(service.template, 'containers') and service.template.containers:
            for container in service.template.containers:
                if hasattr(container, 'env') and container.env:
                    for env_var in container.env:
                        var_name = env_var.name.lower()
                        var_value = env_var.value if hasattr(env_var, 'value') else ""
                        # Check for common secret patterns in env vars
                        if any(keyword in var_name for keyword in ['key', 'secret', 'token', 'password', 'credential']):
                            findings.append({
                                "severity": "HIGH",
                                "issue": f"Service exposes sensitive environment variable: {var_name}",
                                "recommendation": "Use Google Secret Manager to store secrets instead of environment variables",
                                "risk_score": 80
                            })
        
        return findings
        
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Error scanning service {service_name}: {str(e)}")
        logger.error(f"Traceback: {tb}")
        # Also log each line separately for better visibility
        for line in tb.split('\n'):
            if line.strip():
                logger.error(f"TB: {line}")
        return findings


def write_findings_to_bigquery(job_id: str, service_name: str, findings: list):
    """Write findings to BigQuery."""
    if not findings:
        return
    
    try:
        table_id = f"{PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}"
        table = bq_client.get_table(table_id)
        
        rows_to_insert = []
        for finding in findings:
            row = {
                "id": f"{job_id}-{service_name}-{finding['severity'].lower()}-{datetime.now().timestamp()}",
                "job_id": job_id,
                "severity": finding['severity'],
                "resource_type": "Cloud Run Service",
                "resource_name": service_name,
                "issue_description": finding['issue'],
                "recommendation": finding['recommendation'],
                "risk_score": finding['risk_score'],
                "created_at": datetime.utcnow().isoformat()
            }
            rows_to_insert.append(row)
        
        errors = bq_client.insert_rows(table, rows_to_insert)
        if errors:
            logger.error(f"Errors inserting rows: {errors}")
        else:
            logger.info(f"Inserted {len(rows_to_insert)} findings for {service_name}")
            
    except Exception as e:
        logger.error(f"Error writing findings to BigQuery: {e}")


def process_scan_request(message):
    """Process a single scan request message."""
    try:
        # Parse message data
        data = json.loads(message.data.decode('utf-8'))
        job_id = data['job_id']
        service_name = data['service_name']
        region = data.get('region', 'us-central1')
        project_id = data.get('project_id', PROJECT_ID)
        
        logger.info(f"Processing scan request: job_id={job_id}, service={service_name}")
        
        # Scan the service
        findings = scan_cloud_run_service(service_name, region, project_id)
        
        # Write findings to BigQuery
        write_findings_to_bigquery(job_id, service_name, findings)
        
        # Acknowledge message
        message.ack()
        logger.info(f"Successfully processed scan: job_id={job_id}")
        
    except Exception as e:
        logger.error(f"Error processing scan request: {e}")
        message.nack()


def main():
    """Main entry point for the scan processor."""
    logger.info("Starting Cloud Run IAM Security Scanner...")
    
    # Get environment variables for this execution
    job_id = os.environ.get("JOB_ID")
    service_name = os.environ.get("SERVICE_NAME")
    region = os.environ.get("REGION", "us-central1")
    project_id = os.environ.get("PROJECT_ID", PROJECT_ID)
    
    if job_id and service_name:
        # Process a specific scan job
        logger.info(f"Processing scan: job_id={job_id}, service={service_name}")
        
        # Scan the service
        findings = scan_cloud_run_service(service_name, region, project_id)
        
        # Write findings to BigQuery
        write_findings_to_bigquery(job_id, service_name, findings)
        
        logger.info(f"Scan complete: {len(findings)} findings written")
    else:
        # Legacy mode: Pull from Pub/Sub subscription
        logger.info("Running in legacy Pub/Sub mode...")
        subscription_path = subscriber.subscription_path(PROJECT_ID, PUBSUB_SUBSCRIPTION)
        
        def callback(message):
            process_scan_request(message)
        
        # Pull messages
        streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)
        logger.info(f"Listening for messages on {subscription_path}...")
        
        try:
            streaming_pull_future.result()
        except KeyboardInterrupt:
            streaming_pull_future.cancel()


if __name__ == "__main__":
    main()

