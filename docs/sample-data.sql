-- Sample data for BigQuery findings table
-- Use this to populate the table for testing

INSERT INTO `zero_trust_explainer.findings` 
(id, job_id, severity, resource_type, resource_name, issue_description, recommendation, blast_radius, affected_resources, risk_score, created_at)
VALUES
  (
    GENERATE_UUID(),
    'job-001',
    'critical',
    'cloud_run_service',
    'my-public-service',
    'Service allows unauthenticated access with overly permissive IAM bindings',
    'Remove allUsers from invoker role and add specific service accounts',
    'Public access allows any internet user to invoke the service',
    JSON_ARRAY('my-public-service', 'downstream-api'),
    95,
    CURRENT_TIMESTAMP()
  ),
  (
    GENERATE_UUID(),
    'job-001',
    'high',
    'service_account',
    'default-compute@project.iam.gserviceaccount.com',
    'Service account has editor role at project level',
    'Create a custom role with minimal required permissions',
    'Can modify any resource in the project',
    JSON_ARRAY('all-project-resources'),
    85,
    CURRENT_TIMESTAMP()
  ),
  (
    GENERATE_UUID(),
    'job-001',
    'medium',
    'cloud_run_service',
    'internal-api',
    'Service uses default service account instead of dedicated account',
    'Create and assign a dedicated service account with least privilege',
    'May have unnecessary permissions from default account',
    JSON_ARRAY('internal-api'),
    60,
    CURRENT_TIMESTAMP()
  ),
  (
    GENERATE_UUID(),
    'job-002',
    'high',
    'iam_binding',
    'roles/run.admin',
    'Too many principals have Cloud Run Admin role',
    'Limit admin access to only operations team members',
    'Multiple users can deploy and modify Cloud Run services',
    JSON_ARRAY('all-cloudrun-services'),
    80,
    CURRENT_TIMESTAMP()
  ),
  (
    GENERATE_UUID(),
    'job-002',
    'low',
    'cloud_run_service',
    'test-service',
    'Service has debug logging enabled',
    'Disable debug logging in production',
    'May expose sensitive information in logs',
    JSON_ARRAY('test-service'),
    30,
    CURRENT_TIMESTAMP()
  );
