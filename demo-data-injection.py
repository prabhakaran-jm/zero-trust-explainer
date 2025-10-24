#!/usr/bin/env python3
"""
Real Demo Data Injection Script for Zero-Trust Explainer
Actually populates BigQuery with realistic Cloud Run IAM findings for demonstration
"""

import requests
import json
import time
from datetime import datetime, timezone
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# Configuration
BACKEND_URL = "https://zte-backend-api-cvy4lwzu3q-uc.a.run.app"
PROJECT_ID = "gcr-hackathon"
DATASET_ID = "zero_trust_explainer"
TABLE_ID = "findings"

# Demo findings data
DEMO_FINDINGS = [
    {
        "id": "demo-finding-001",
        "job_id": "demo-scan-20241024",
        "severity": "CRITICAL",
        "resource_type": "Cloud Run Service",
        "resource_name": "payment-processor-v2",
        "issue_description": "Service allows unauthenticated access (allUsers invoker permission)",
        "recommendation": "Restrict access to authenticated users only",
        "blast_radius": "All internet users can invoke the service",
        "affected_resources": "payment-processor-v2, payment-data, customer-info",
        "risk_score": 95,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "demo-finding-002",
        "job_id": "demo-scan-20241024",
        "severity": "HIGH",
        "resource_type": "Service Account",
        "resource_name": "payment-processor-sa@project.iam.gserviceaccount.com",
        "issue_description": "Service account has Editor role instead of least-privilege access",
        "recommendation": "Implement least-privilege principle with specific roles",
        "blast_radius": "Full project access including all resources",
        "affected_resources": "All project resources, databases, storage buckets",
        "risk_score": 85,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "demo-finding-003",
        "job_id": "demo-scan-20241024",
        "severity": "MEDIUM",
        "resource_type": "IAM Policy",
        "resource_name": "payment-processor-sa permissions",
        "issue_description": "Service account lacks specific permissions for Cloud Storage and BigQuery access",
        "recommendation": "Add required permissions for external resource access",
        "blast_radius": "Service failures when accessing external resources",
        "affected_resources": "Cloud Storage buckets, BigQuery datasets",
        "risk_score": 60,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "demo-finding-004",
        "job_id": "demo-scan-20241024",
        "severity": "HIGH",
        "resource_type": "Cloud Run Configuration",
        "resource_name": "payment-processor-v2 environment",
        "issue_description": "Sensitive API keys stored as plain text environment variables",
        "recommendation": "Use Google Secret Manager for sensitive data",
        "blast_radius": "API key exposure in logs and runtime environment",
        "affected_resources": "Payment gateway API keys, database credentials",
        "risk_score": 80,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "demo-finding-005",
        "job_id": "demo-scan-20241024",
        "severity": "MEDIUM",
        "resource_type": "VPC Configuration",
        "resource_name": "payment-processor-v2 network",
        "issue_description": "Service not configured with VPC connector for private network access",
        "recommendation": "Implement VPC connector for secure internal communication",
        "blast_radius": "Unencrypted traffic over public internet",
        "affected_resources": "Internal API calls, database connections",
        "risk_score": 55,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "demo-finding-006",
        "job_id": "demo-scan-20241024",
        "severity": "LOW",
        "resource_type": "Cloud Run Service",
        "resource_name": "user-profile-service",
        "issue_description": "Service has no custom domain configured",
        "recommendation": "Configure custom domain for better branding and security",
        "blast_radius": "Potential phishing attacks using similar domain names",
        "affected_resources": "user-profile-service, user authentication",
        "risk_score": 25,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "demo-finding-007",
        "job_id": "demo-scan-20241024",
        "severity": "HIGH",
        "resource_type": "Cloud Run Service",
        "resource_name": "order-processing-service",
        "issue_description": "Service has no request timeout configured",
        "recommendation": "Configure appropriate request timeout to prevent resource exhaustion",
        "blast_radius": "Potential DoS attacks through long-running requests",
        "affected_resources": "order-processing-service, payment processing",
        "risk_score": 75,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

def test_backend_connection():
    """Test if backend is accessible"""
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        if response.status_code == 200:
            print("✅ Backend API is accessible")
            data = response.json()
            if data.get("ai_studio", {}).get("enabled"):
                print("✅ AI Studio is enabled")
                print(f"✅ AI Model: {data['ai_studio']['model']}")
            else:
                print("⚠️  AI Studio is disabled")
            return True
        else:
            print(f"❌ Backend API returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend API connection failed: {e}")
        return False

def get_bigquery_client():
    """Initialize BigQuery client"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        print("✅ BigQuery client initialized")
        return client
    except Exception as e:
        print(f"❌ BigQuery client initialization failed: {e}")
        return None

def check_dataset_exists(client):
    """Check if the dataset exists"""
    try:
        dataset_ref = client.dataset(DATASET_ID)
        dataset = client.get_dataset(dataset_ref)
        print(f"✅ Dataset '{DATASET_ID}' exists")
        return True
    except NotFound:
        print(f"❌ Dataset '{DATASET_ID}' not found")
        return False
    except Exception as e:
        print(f"❌ Error checking dataset: {e}")
        return False

def check_table_exists(client):
    """Check if the table exists"""
    try:
        table_ref = client.dataset(DATASET_ID).table(TABLE_ID)
        table = client.get_table(table_ref)
        print(f"✅ Table '{TABLE_ID}' exists")
        return True
    except NotFound:
        print(f"❌ Table '{TABLE_ID}' not found")
        return False
    except Exception as e:
        print(f"❌ Error checking table: {e}")
        return False

def clear_existing_demo_data(client):
    """Clear existing demo data from the table"""
    try:
        query = f"""
        DELETE FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
        WHERE job_id = 'demo-scan-20241024'
        """
        
        query_job = client.query(query)
        query_job.result()  # Wait for the job to complete
        
        print("✅ Cleared existing demo data")
        return True
    except Exception as e:
        print(f"❌ Failed to clear existing demo data: {e}")
        return False

def insert_demo_findings(client):
    """Insert demo findings into BigQuery"""
    try:
        table_ref = client.dataset(DATASET_ID).table(TABLE_ID)
        table = client.get_table(table_ref)
        
        # Prepare rows for insertion
        rows_to_insert = []
        for finding in DEMO_FINDINGS:
            row = {
                "id": finding["id"],
                "job_id": finding["job_id"],
                "severity": finding["severity"],
                "resource_type": finding["resource_type"],
                "resource_name": finding["resource_name"],
                "issue_description": finding["issue_description"],
                "recommendation": finding["recommendation"],
                "blast_radius": finding["blast_radius"],
                "affected_resources": finding["affected_resources"],
                "risk_score": finding["risk_score"],
                "created_at": finding["created_at"]
            }
            rows_to_insert.append(row)
        
        # Insert rows
        errors = client.insert_rows_json(table, rows_to_insert)
        
        if errors:
            print(f"❌ Errors inserting rows: {errors}")
            return False
        else:
            print(f"✅ Successfully inserted {len(rows_to_insert)} demo findings")
            return True
            
    except Exception as e:
        print(f"❌ Failed to insert demo findings: {e}")
        return False

def verify_data_insertion(client):
    """Verify that data was inserted correctly"""
    try:
        query = f"""
        SELECT COUNT(*) as count
        FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
        WHERE job_id = 'demo-scan-20241024'
        """
        
        query_job = client.query(query)
        results = query_job.result()
        
        for row in results:
            count = row.count
            print(f"✅ Verified: {count} demo findings in BigQuery")
            return count > 0
            
    except Exception as e:
        print(f"❌ Failed to verify data insertion: {e}")
        return False

def test_ai_explanations():
    """Test AI explanation generation for demo findings"""
    print("\n🤖 Testing AI explanations...")
    
    for finding in DEMO_FINDINGS[:2]:  # Test first 2 findings
        try:
            finding_id = finding["id"]
            print(f"  Testing AI explanation for: {finding['resource_name']}")
            
            # Call the actual /explain/{id} endpoint
            response = requests.get(f"{BACKEND_URL}/explain/{finding_id}", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                print(f"    ✅ AI explanation generated")
                print(f"    ✅ Blast radius: {data.get('blast_radius', 'N/A')[:50]}...")
                print(f"    ✅ Risk assessment: {data.get('risk_assessment', 'N/A')[:50]}...")
            else:
                print(f"    ⚠️  AI explanation returned status {response.status_code}")
            
        except Exception as e:
            print(f"❌ AI explanation failed for {finding['resource_name']}: {e}")

def test_ai_proposals():
    """Test AI fix proposal generation"""
    print("\n🔧 Testing AI fix proposals...")
    
    try:
        # Call the actual /propose/{job_id} endpoint
        response = requests.post(f"{BACKEND_URL}/propose/demo-scan-20241024", timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print("  ✅ AI fix proposal generated")
            print(f"  ✅ Terraform code: {len(data.get('terraform_code', ''))} characters")
            print(f"  ✅ Implementation steps: {len(data.get('implementation_steps', []))} steps")
        else:
            print(f"  ⚠️  AI proposal returned status {response.status_code}")
        
    except Exception as e:
        print(f"❌ AI proposal generation failed: {e}")

def main():
    """Main demo data injection function"""
    print("🎬 Zero-Trust Explainer Demo Data Injection")
    print("=" * 60)
    
    # Test backend connection
    if not test_backend_connection():
        print("\n❌ Demo setup failed - backend not accessible")
        return
    
    # Initialize BigQuery client
    client = get_bigquery_client()
    if not client:
        print("\n❌ Demo setup failed - BigQuery client not available")
        return
    
    # Check dataset and table existence
    if not check_dataset_exists(client):
        print("\n❌ Demo setup failed - BigQuery dataset not found")
        return
    
    if not check_table_exists(client):
        print("\n❌ Demo setup failed - BigQuery table not found")
        return
    
    # Clear existing demo data
    print("\n🧹 Clearing existing demo data...")
    clear_existing_demo_data(client)
    
    # Insert demo findings
    print("\n📊 Inserting demo findings into BigQuery...")
    if not insert_demo_findings(client):
        print("\n❌ Demo setup failed - could not insert demo findings")
        return
    
    # Verify data insertion
    print("\n🔍 Verifying data insertion...")
    if not verify_data_insertion(client):
        print("\n❌ Demo setup failed - data verification failed")
        return
    
    # Test AI features
    test_ai_explanations()
    test_ai_proposals()
    
    print("\n🎯 Demo Data Injection Complete!")
    print("=" * 60)
    print("📱 Frontend URL: https://zte-frontend-cvy4lwzu3q-uc.a.run.app")
    print("🔗 Backend URL: https://zte-backend-api-cvy4lwzu3q-uc.a.run.app")
    print(f"📊 BigQuery Dataset: {PROJECT_ID}.{DATASET_ID}.{TABLE_ID}")
    print(f"📈 Demo Findings: {len(DEMO_FINDINGS)} records inserted")
    
    print("\n🎬 Ready for demo presentation!")
    print("\nDemo Scenarios Available:")
    for i, finding in enumerate(DEMO_FINDINGS, 1):
        print(f"  {i}. {finding['severity']} - {finding['issue_description'][:60]}...")
    
    print("\n🎥 Demo Flow:")
    print("  1. Navigate to frontend URL")
    print("  2. Show AI Studio status")
    print("  3. View findings list (should show demo data)")
    print("  4. Click '🤖 AI Explain' on findings")
    print("  5. Highlight AI-generated content")
    print("  6. Click '🤖 AI Propose' for fixes")
    print("  7. Show Terraform code generation")

if __name__ == "__main__":
    main()
