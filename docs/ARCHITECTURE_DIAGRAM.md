# Zero-Trust Explainer Architecture Diagram 🤖

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Zero-Trust Explainer Platform                        │
│                         AI-Powered Security Analysis                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI    │    │   Backend API    │    │  Google AI      │
│   (React/Vite)   │◄──►│   (FastAPI)      │◄──►│  Studio         │
│                  │    │                  │    │  (Gemini Pro)   │
│ • Job Cards       │    │ • REST Endpoints │    │                 │
│ • AI Indicators   │    │ • AI Service     │    │ • Security      │
│ • Modal Displays  │    │ • Data Processing│    │   Analysis      │
│ • Real-time UI    │    │ • Error Handling │    │ • Code Gen      │
└─────────────────┘    └─────────────────┘    │ • Summaries     │
                                               └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Google Cloud Platform                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cloud Run      │    │   Cloud Run      │    │   Cloud Run      │
│   Services       │    │   Jobs           │    │   (Frontend)    │
│                  │    │                  │    │                 │
│ • Backend API    │    │ • AI Report      │    │ • React App     │
│ • Auto-scaling   │    │   Generation     │    │ • Nginx Server  │
│ • Health Checks  │    │ • Terraform Code │    │ • Static Files  │
│ • Load Balancing │    │ • Async Processing│   │ • CDN Ready     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pub/Sub        │    │   BigQuery      │    │   Cloud         │
│   Messaging      │    │   Data          │    │   Storage       │
│                  │    │   Warehouse     │    │                 │
│ • Scan Requests  │    │ • Findings Data │    │ • AI Reports    │
│ • Event Queue    │    │ • Partitioned   │    │ • Signed URLs   │
│ • Async Processing│   │ • Queryable     │    │ • Secure Access │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Artifact       │    │   IAM &         │    │   Terraform      │
│   Registry       │    │   Security      │    │   Infrastructure │
│                  │    │                 │    │                 │
│ • Container      │    │ • Service       │    │ • IaC           │
│   Images         │    │   Accounts      │    │ • Modular       │
│ • Versioning     │    │ • Least         │    │ • Remote State  │
│ • CI/CD Ready    │    │   Privilege     │    │ • Production    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI-Powered Data Flow                              │
└─────────────────────────────────────────────────────────────────────────────────┘

1. SCAN REQUEST
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │   User      │───►│  Frontend   │───►│  Backend    │
   │   Input     │    │   UI        │    │   API       │
   └─────────────┘    └─────────────┘    └─────────────┘
                                │
                                ▼
                       ┌─────────────┐
                       │   Pub/Sub   │
                       │   Queue     │
                       └─────────────┘

2. FINDINGS STORAGE
                       ┌─────────────┐    ┌─────────────┐
                       │   BigQuery  │◄───│  Scan       │
                       │   Dataset   │    │  Processor  │
                       └─────────────┘    └─────────────┘

3. AI ANALYSIS
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │   Frontend  │───►│  Backend    │───►│  Gemini     │
   │   Request   │    │   AI        │    │  Pro        │
   └─────────────┘    │   Service   │    └─────────────┘
                      └─────────────┘
                                │
                                ▼
                       ┌─────────────┐
                       │  AI         │
                       │  Response   │
                       │  Processing │
                       └─────────────┘

4. REMEDIATION GENERATION
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │   Frontend  │───►│  Cloud Run  │───►│  Gemini     │
   │   Propose   │    │  Job         │    │  Pro        │
   └─────────────┘    └─────────────┘    └─────────────┘
                                │
                                ▼
                       ┌─────────────┐
                       │  Terraform  │
                       │  Code       │
                       │  Generation │
                       └─────────────┘
                                │
                                ▼
                       ┌─────────────┐
                       │  Cloud      │
                       │  Storage    │
                       │  Report     │
                       └─────────────┘
```

## AI Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AI Studio Integration                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Security       │    │   AI Service     │    │   Gemini        │
│   Findings       │───►│   Layer          │───►│   Pro           │
│                  │    │                  │    │                 │
│ • IAM Issues     │    │ • Model          │    │ • Natural       │
│ • Risk Scores    │    │   Management     │    │   Language      │
│ • Resource Data  │    │ • Prompt         │    │   Processing   │
│ • Metadata       │    │   Engineering   │    │ • Code          │
└─────────────────┘    │ • Response       │    │   Generation    │
                       │   Parsing        │    │ • Risk          │
                       │ • Error          │    │   Analysis      │
                       │   Handling       │    │ • Compliance    │
                       └─────────────────┘    │   Mapping       │
                                               └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI            │    │   Structured    │    │   Frontend      │
│   Responses      │◄───│   Data          │◄───│   Display       │
│                  │    │   Processing    │    │                 │
│ • Explanations   │    │                  │    │ • Modal        │
│ • Risk Analysis  │    │ • JSON Parsing  │    │   Windows      │
│ • Terraform Code │    │ • Validation    │    │ • Rich         │
│ • Summaries      │    │ • Fallback      │    │   Formatting   │
│ • Recommendations│   │   Logic         │    │ • AI Indicators │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Security Layers                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Network        │    │   Application    │    │   Data          │
│   Security       │    │   Security       │    │   Security      │
│                  │    │                  │    │                 │
│ • VPC Networks   │    │ • IAM Roles      │    │ • Encryption    │
│ • Firewall       │    │ • Service        │    │   at Rest      │
│   Rules          │    │   Accounts       │    │ • Encryption    │
│ • Load           │    │ • Least          │    │   in Transit   │
│   Balancers      │    │   Privilege      │    │ • Access        │
└─────────────────┘    └─────────────────┘    │   Controls     │
                                               └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API           │    │   Monitoring     │    │   Compliance     │
│   Security       │    │   & Logging     │    │   & Audit       │
│                  │    │                  │    │                 │
│ • Rate Limiting  │    │ • Cloud          │    │ • Audit Logs    │
│ • CORS           │    │   Logging       │    │ • Compliance    │
│   Policies       │    │ • Error         │    │   Reports       │
│ • Input          │    │   Tracking      │    │ • Security      │
│   Validation     │    │ • Performance    │    │   Scanning      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Deployment Pipeline                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development    │    │   CI/CD         │    │   Production     │
│   Environment    │    │   Pipeline      │    │   Environment   │
│                  │    │                  │    │                 │
│ • Local          │    │ • GitHub        │    │ • Cloud Run     │
│   Development    │    │   Actions       │    │   Services      │
│ • Docker         │    │ • Automated     │    │ • Auto-scaling  │
│   Containers     │    │   Testing       │    │ • Load          │
│ • Hot Reload     │    │ • Image         │    │   Balancing     │
└─────────────────┘    │   Building      │    │ • Health        │
                       │ • Deployment    │    │   Monitoring    │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Infrastructure │
                       │   Management     │
                       │                  │
                       │ • Terraform      │
                       │ • Remote State   │
                       │ • Environment   │
                       │   Variables     │
                       │ • Secrets       │
                       │   Management    │
                       └─────────────────┘
```

## Component Details

### Frontend Components
- **JobCard**: Displays scan results with AI indicators
- **FindingsList**: Shows findings with severity filtering
- **ScanForm**: Initiates new security scans
- **AIModal**: Rich display of AI-generated content
- **LoadingStates**: User feedback during AI processing

### Backend Services
- **AIService**: Gemini Pro integration and response processing
- **ScanService**: Pub/Sub message publishing
- **FindingService**: BigQuery data retrieval
- **ReportService**: Cloud Run Job execution
- **HealthService**: System monitoring and status

### Infrastructure Components
- **Cloud Run Services**: Scalable backend and frontend
- **Cloud Run Jobs**: Asynchronous AI processing
- **BigQuery**: Partitioned data warehouse
- **Pub/Sub**: Event-driven messaging
- **Cloud Storage**: Secure report storage
- **Artifact Registry**: Container image management

### AI Integration Points
- **Model Initialization**: Robust Gemini Pro setup with fallbacks
- **Prompt Engineering**: Structured prompts for consistent responses
- **Response Parsing**: JSON extraction with error handling
- **Fallback Logic**: Graceful degradation when AI unavailable
- **Error Recovery**: Comprehensive logging and retry mechanisms
