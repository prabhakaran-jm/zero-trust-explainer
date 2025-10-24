# AI Studio (Gemini) Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "404 models/gemini-pro is not found"

**Cause**: The model name format or API version is incorrect, or the API isn't enabled.

**Solutions**:

#### A. Use the Latest Model Names (2025)
The code now tries multiple model names in this order:
1. `gemini-1.5-flash` - Fastest, recommended for most use cases
2. `gemini-1.5-pro` - Most capable, for complex tasks
3. `gemini-pro` - Legacy model (may be deprecated)

#### B. Enable the Generative Language API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services > Library**
4. Search for "Generative Language API"
5. Click **Enable**

#### C. Verify Your API Key
```bash
# Test your API key with curl
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"

# You should see a list of available models
```

#### D. Check API Key Restrictions
1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your API key
3. Check **Application restrictions**:
   - If using "IP addresses", add your Cloud Run service's egress IPs
   - Recommendation: Use "None" for testing, then lock down for production
4. Check **API restrictions**:
   - Ensure "Generative Language API" is allowed

### Issue 2: API Key Not Working in Cloud Run

**Symptoms**: Works locally but fails in Cloud Run

**Causes & Solutions**:

#### A. Environment Variable Not Set
```bash
# Check if the variable is set in Cloud Run
gcloud run services describe zte-backend-api \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

Make sure `GEMINI_API_KEY` appears in the output.

#### B. Network Restrictions
Cloud Run egress IPs may be blocked by API key restrictions.

**Fix**: Remove IP restrictions from your API key (or add Cloud Run IPs to allowlist)

#### C. Service Account Permissions
Although AI Studio uses API keys (not service account auth), ensure your Cloud Run service account has internet access.

### Issue 3: Rate Limiting Errors

**Symptoms**: `429 Too Many Requests` or `RESOURCE_EXHAUSTED`

**Solutions**:

#### A. Implement Retry Logic
The code now has built-in retry for model initialization.

#### B. Use Exponential Backoff
```python
import time
from google.api_core import retry

@retry.Retry(
    initial=1.0,
    maximum=60.0,
    multiplier=2.0,
    deadline=300.0
)
def generate_with_retry(model, prompt):
    return model.generate_content(prompt)
```

#### C. Upgrade to Vertex AI
For production workloads with high volume, consider Vertex AI which has higher quotas.

### Issue 4: Network/Firewall Errors

**Symptoms**: `Connection refused`, `Timeout`, or `SSL errors`

**Solutions**:

#### A. Check Cloud Run Networking
Ensure Cloud Run can access external APIs:
```bash
# Test from Cloud Run
gcloud run services describe zte-backend-api \
  --region=us-central1 \
  --format="value(spec.template.metadata.annotations)"
```

Look for VPC connector settings - if using VPC, ensure NAT is configured.

#### B. Test DNS Resolution
The API endpoint is: `generativelanguage.googleapis.com`

#### C. Check Firewall Rules
If using VPC connector, ensure egress is allowed to Google APIs.

### Issue 5: Authentication Errors

**Symptoms**: `401 Unauthorized` or `403 Forbidden`

**Solutions**:

#### A. Regenerate API Key
1. Go to [AI Studio](https://aistudio.google.com/)
2. Click "Get API key"
3. Create a new key
4. Update the environment variable in Cloud Run

#### B. Check API Key Format
- Should be a long string starting with `AI...`
- No spaces or line breaks
- Set in environment, not hardcoded

## Debugging in Cloud Run

### View Logs
```bash
# Stream logs from Cloud Run
gcloud run services logs read zte-backend-api \
  --region=us-central1 \
  --limit=50

# Look for these messages:
# ✅ "AI Studio initialized successfully with model: gemini-1.5-flash"
# ❌ "All AI Studio model attempts failed"
```

### Test the Health Endpoint
```bash
# Check if AI is enabled
curl https://your-backend-url.run.app/

# Response should show:
{
  "ai_studio": {
    "enabled": true,
    "model": "gemini-1.5-flash"
  }
}
```

### Manual Testing in Cloud Run
```bash
# SSH into a Cloud Run instance (requires Cloud Run Admin role)
gcloud run services proxy zte-backend-api --region=us-central1

# In another terminal, test
python3 << EOF
import google.generativeai as genai
genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel("gemini-1.5-flash")
response = model.generate_content("Hello")
print(response.text)
EOF
```

## Best Practices for AI Studio in Cloud Run

### 1. Use Latest SDK Version
```bash
pip install --upgrade google-generativeai
```

Current recommended version: `>= 0.8.0`

### 2. Implement Graceful Degradation
The code now:
- ✅ Tries multiple model names automatically
- ✅ Logs detailed error messages
- ✅ Falls back to non-AI explanations
- ✅ Doesn't crash if AI is unavailable

### 3. Set Appropriate Timeouts
```python
generation_config = genai.types.GenerationConfig(
    max_output_tokens=1000,
    temperature=0.7,
    timeout=30  # seconds
)
```

### 4. Monitor Usage
- Go to [AI Studio](https://aistudio.google.com/)
- Check your API quota usage
- Set up billing alerts

### 5. Security
- ✅ Use environment variables for API keys
- ✅ Don't commit API keys to git
- ✅ Rotate keys periodically
- ✅ Use API restrictions in production

## Getting Help

### Check Model Availability
```bash
# List all available models
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY" | jq '.models[].name'
```

### Test API Access
```bash
# Test a simple generation
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello, are you working?"
      }]
    }]
  }'
```

### Resources
- [AI Studio Documentation](https://ai.google.dev/docs)
- [API Reference](https://ai.google.dev/api/python/google/generativeai)
- [Model Availability](https://ai.google.dev/models/gemini)
- [Rate Limits](https://ai.google.dev/pricing)

## Migration to Vertex AI (Optional)

If you decide to migrate to Vertex AI later for production:

### Advantages
- ✅ Higher rate limits and quotas
- ✅ Service account authentication (no API keys)
- ✅ Better integration with GCP
- ✅ SLA guarantees
- ✅ Private endpoint support

### Code Changes Required
```python
# Instead of:
import google.generativeai as genai
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

# Use:
import vertexai
from vertexai.generative_models import GenerativeModel
vertexai.init(project=PROJECT_ID, location=REGION)
model = GenerativeModel("gemini-1.5-flash")
```

The API is very similar, so migration is straightforward!
