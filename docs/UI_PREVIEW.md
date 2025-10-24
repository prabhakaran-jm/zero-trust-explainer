# Zero-Trust Explainer - UI Preview

## Application Layout

### Header
```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ Zero-Trust Explainer                                    │
│  Human-readable IAM diffs for Cloud Run                     │
└─────────────────────────────────────────────────────────────┘
```

### Scan Submission Section
```
┌─────────────────────────────────────────────────────────────┐
│  Submit Scan                                                 │
│                                                              │
│  Service Name *                                              │
│  [my-cloud-run-service________________________]              │
│                                                              │
│  Region                                                      │
│  [us-central1 (optional)_____________________]              │
│                                                              │
│  Project ID                                                  │
│  [my-gcp-project (optional)__________________]              │
│                                                              │
│                         [🔍 Start Scan]                      │
└─────────────────────────────────────────────────────────────┘
```

### Recent Scan Jobs Section
```
┌─────────────────────────────────────────────────────────────┐
│  Recent Scan Jobs                          [🔄 Refresh]      │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────┐         │
│  │ Job: 550e8400...     │ │ Job: 449d7300...     │         │
│  │ [5 findings]         │ │ [3 findings]         │         │
│  │                      │ │                      │         │
│  │ [1] Critical         │ │ [2] High             │         │
│  │ [2] High             │ │ [1] Medium           │         │
│  │ [1] Medium           │ │                      │         │
│  │ [1] Low              │ │                      │         │
│  │                      │ │                      │         │
│  │ 2024-01-15 10:30:00  │ │ 2024-01-15 09:15:00  │         │
│  │              [💡 Propose] │ [💡 Propose]       │         │
│  └──────────────────────┘ └──────────────────────┘         │
│                                                              │
│  ┌──────────────────────┐                                   │
│  │ Job: 338c6200...     │ (More jobs...)                    │
│  │ [7 findings]         │                                   │
│  │ ...                  │                                   │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### Findings Section (When Job Selected)
```
┌─────────────────────────────────────────────────────────────┐
│  Findings for Job 550e8400...                               │
│                                                              │
│  Severity Filter: [All ▼]                                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [CRITICAL] cloud_run_service                            ││
│  │                                                          ││
│  │ my-public-service                                        ││
│  │                                                          ││
│  │ Service allows unauthenticated access with overly       ││
│  │ permissive IAM bindings                                 ││
│  │                                                          ││
│  │ Recommendation: Remove allUsers from invoker role       ││
│  │ and add specific service accounts                       ││
│  │                                                          ││
│  │ 2024-01-15 10:30:00                    [📖 Explain]     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [HIGH] service_account                                  ││
│  │                                                          ││
│  │ default-compute@project.iam.gserviceaccount.com         ││
│  │                                                          ││
│  │ Service account has editor role at project level        ││
│  │                                                          ││
│  │ Recommendation: Create a custom role with minimal       ││
│  │ required permissions                                    ││
│  │                                                          ││
│  │ 2024-01-15 10:31:00                    [📖 Explain]     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  (More findings...)                                          │
└─────────────────────────────────────────────────────────────┘
```

## Color Scheme

### Severity Colors
- **Critical**: Red (#dc3545)
- **High**: Orange (#fd7e14)
- **Medium**: Yellow (#ffc107)
- **Low**: Green (#28a745)

### Primary Colors
- **Background**: Light gray (#f5f5f5)
- **Cards**: White (#ffffff)
- **Primary Actions**: Purple gradient (#667eea → #764ba2)
- **Text**: Dark gray (#333333)

## Interactive Elements

### Buttons
- **Start Scan**: Large purple button with magnifying glass icon
- **Refresh**: Purple button with refresh icon
- **Propose**: Green button with lightbulb icon
- **Explain**: Purple button with book icon

### Job Cards
- **Default State**: White background with gray border
- **Selected State**: Light purple background (#f8f9ff) with purple border
- **Hover State**: Subtle shadow and border color change

### Severity Badges
- Colored background matching severity
- White text
- Rounded corners
- Count displayed in badge

## User Interactions

1. **Submit Scan**
   - User fills in service name (required)
   - Optional region and project ID
   - Clicks "Start Scan"
   - Alert shows job ID
   - Jobs list refreshes automatically

2. **View Jobs**
   - Jobs displayed as cards
   - Each card shows job ID, finding count, and severity breakdown
   - Click card to select and view findings
   - Selected card highlighted with purple background

3. **Filter Findings**
   - Select job by clicking card
   - Use severity dropdown to filter
   - Findings update in real-time

4. **Explain Finding**
   - Click "Explain" button on any finding
   - Alert shows detailed explanation with blast radius
   - Includes affected resources and risk score

5. **Propose Fixes**
   - Click "Propose" button on job card
   - Triggers Cloud Run Job
   - Alert shows execution details and report URL (if available)

## Responsive Design

### Desktop (> 768px)
- Jobs grid: 3 columns
- Full navigation visible
- Spacious layout

### Tablet (768px - 1024px)
- Jobs grid: 2 columns
- Compact navigation
- Adjusted spacing

### Mobile (< 768px)
- Jobs grid: 1 column
- Stacked layout
- Full-width elements
- Simplified header

## Loading States

- **Loading**: Spinner or "Loading..." text
- **Empty State**: "No jobs found. Submit a scan to get started."
- **Error State**: Red banner with error message

## Accessibility

- Semantic HTML elements
- ARIA labels where appropriate
- Keyboard navigation support
- High contrast ratios
- Focus indicators on interactive elements
