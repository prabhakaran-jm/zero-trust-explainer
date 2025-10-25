#!/usr/bin/env python3
"""
Zero-Trust Explainer Demo Script 🤖
AI-Powered Security Analysis Showcase

This script demonstrates the AI features of Zero-Trust Explainer
using Google AI Studio and Gemini Pro integration.
"""

import requests
import json
import time
from typing import Dict, Any

class ZTEDemo:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    def print_header(self, title: str):
        """Print a formatted header."""
        print(f"\n{'='*60}")
        print(f"🤖 {title}")
        print(f"{'='*60}")
    
    def print_section(self, title: str):
        """Print a formatted section header."""
        print(f"\n📋 {title}")
        print("-" * 40)
    
    def demo_health_check(self):
        """Demo: Health check endpoint."""
        self.print_header("Health Check")
        
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                print("✅ Service is healthy and running")
                print(f"Response: {response.json()}")
            else:
                print(f"❌ Health check failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def demo_list_jobs(self):
        """Demo: List recent scan jobs."""
        self.print_header("Recent Scan Jobs")
        
        try:
            response = self.session.get(f"{self.base_url}/jobs?limit=5")
            if response.status_code == 200:
                data = response.json()
                print(f"📊 Found {data['count']} recent jobs")
                
                for job in data['jobs'][:3]:  # Show first 3
                    print(f"\n🔍 Job ID: {job['job_id']}")
                    print(f"   Findings: {job['finding_count']}")
                    print(f"   Severity Breakdown:")
                    for severity, count in job['severity_counts'].items():
                        print(f"     {severity}: {count}")
            else:
                print(f"❌ Failed to list jobs: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def demo_get_findings(self, job_id: str):
        """Demo: Get findings for a specific job."""
        self.print_header(f"Findings for Job: {job_id}")
        
        try:
            response = self.session.get(f"{self.base_url}/findings/{job_id}")
            if response.status_code == 200:
                data = response.json()
                print(f"📊 Found {data['count']} findings")
                
                for i, finding in enumerate(data['findings'][:3], 1):  # Show first 3
                    print(f"\n🔍 Finding #{i}: {finding['id']}")
                    print(f"   Severity: {finding['severity']}")
                    print(f"   Resource: {finding['resource_name']}")
                    print(f"   Issue: {finding['issue_description']}")
                    print(f"   Recommendation: {finding['recommendation']}")
            else:
                print(f"❌ Failed to get findings: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def demo_ai_explain(self, finding_id: str):
        """Demo: AI-powered explanation."""
        self.print_header(f"AI Explanation for Finding: {finding_id}")
        
        try:
            response = self.session.get(f"{self.base_url}/explain/{finding_id}")
            if response.status_code == 200:
                data = response.json()
                
                print(f"🤖 AI Model: {data.get('ai_model', 'Unknown')}")
                print(f"🔋 AI Powered: {data.get('ai_powered', False)}")
                
                self.print_section("AI Explanation")
                print(data.get('ai_explanation', 'No explanation available'))
                
                self.print_section("Blast Radius Analysis")
                print(data.get('blast_radius', 'No blast radius analysis'))
                
                self.print_section("Risk Assessment")
                print(data.get('risk_assessment', 'No risk assessment'))
                
                self.print_section("Business Impact")
                print(f"Impact Level: {data.get('business_impact', 'Unknown')}")
                print(f"Priority Score: {data.get('priority_score', 'N/A')}/100")
                print(f"Remediation Urgency: {data.get('remediation_urgency', 'Unknown')}")
                
                self.print_section("Attack Vector")
                print(data.get('attack_vector', 'No attack vector analysis'))
                
                self.print_section("Compliance Impact")
                print(data.get('compliance_impact', 'No compliance analysis'))
            else:
                print(f"❌ Failed to get AI explanation: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def demo_ai_summary(self, job_id: str):
        """Demo: AI-powered executive summary."""
        self.print_header(f"AI Executive Summary for Job: {job_id}")
        
        try:
            response = self.session.get(f"{self.base_url}/summary/{job_id}")
            if response.status_code == 200:
                data = response.json()
                summary = data.get('summary', {})
                
                print(f"🤖 AI Model: {summary.get('ai_model', 'Unknown')}")
                print(f"🔋 AI Powered: {summary.get('ai_powered', False)}")
                print(f"📊 Total Findings: {data.get('total_findings', 0)}")
                
                self.print_section("Executive Summary")
                print(summary.get('executive_summary', 'No summary available'))
                
                self.print_section("Risk Overview")
                print(summary.get('risk_overview', 'No risk overview'))
                
                self.print_section("Top Concerns")
                concerns = summary.get('top_concerns', [])
                for i, concern in enumerate(concerns, 1):
                    print(f"{i}. {concern}")
                
                self.print_section("Compliance Status")
                print(summary.get('compliance_status', 'No compliance analysis'))
                
                self.print_section("Remediation Roadmap")
                print(summary.get('remediation_roadmap', 'No roadmap available'))
                
                self.print_section("Strategic Recommendations")
                recommendations = summary.get('recommendations', [])
                for i, rec in enumerate(recommendations, 1):
                    print(f"{i}. {rec}")
                
                self.print_section("Severity Breakdown")
                severity_counts = summary.get('severity_counts', {})
                for severity, count in severity_counts.items():
                    print(f"   {severity}: {count}")
            else:
                print(f"❌ Failed to get AI summary: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def demo_ai_propose(self, job_id: str):
        """Demo: AI-powered fix proposal."""
        self.print_header(f"AI Fix Proposal for Job: {job_id}")
        
        try:
            print("🚀 Triggering AI-powered Cloud Run Job...")
            response = self.session.post(f"{self.base_url}/propose/{job_id}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ AI proposal job triggered successfully!")
                print(f"📋 Status: {data.get('status', 'Unknown')}")
                print(f"🔗 Execution: {data.get('execution_name', 'N/A')}")
                
                if 'report_url' in data:
                    print(f"📄 Report URL: {data['report_url']}")
                    print("💡 Note: Report will be available after job completion")
                else:
                    print("💡 Note: Report bucket not configured")
            else:
                print(f"❌ Failed to trigger AI proposal: {response.status_code}")
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def run_full_demo(self):
        """Run a complete demo showcasing all AI features."""
        self.print_header("Zero-Trust Explainer AI Demo")
        print("🤖 Demonstrating AI-powered security analysis with Gemini Pro")
        
        # Step 1: Health check
        self.demo_health_check()
        
        # Step 2: List jobs
        self.demo_list_jobs()
        
        # Step 3: Get findings (using a sample job ID)
        sample_job_id = "demo-scan-20241024"  # Replace with actual job ID
        self.demo_get_findings(sample_job_id)
        
        # Step 4: AI explanation (using a sample finding ID)
        sample_finding_id = "demo-finding-001"  # Replace with actual finding ID
        self.demo_ai_explain(sample_finding_id)
        
        # Step 5: AI summary
        self.demo_ai_summary(sample_job_id)
        
        # Step 6: AI proposal
        self.demo_ai_propose(sample_job_id)
        
        self.print_header("Demo Complete!")
        print("🎉 All AI features demonstrated successfully!")
        print("💡 Visit the frontend URL for interactive experience")

def main():
    """Main demo function."""
    print("🤖 Zero-Trust Explainer AI Demo")
    print("=" * 50)
    
    # Configuration
    BASE_URL = "https://your-backend-url.run.app"  # Replace with actual URL
    
    print(f"🌐 Backend URL: {BASE_URL}")
    print("📝 Note: Update BASE_URL and sample IDs for your deployment")
    
    # Create demo instance
    demo = ZTEDemo(BASE_URL)
    
    # Run demo
    try:
        demo.run_full_demo()
    except KeyboardInterrupt:
        print("\n\n⏹️ Demo interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Demo failed: {e}")

if __name__ == "__main__":
    main()
