# Generate Architecture Diagrams

## Quick Start

### Option 1: Online Tool (Easiest)

1. Go to [Mermaid Live Editor](https://mermaid.live/)
2. Open one of these files:
   - `docs/architecture-diagram-minimal.mmd` (Simple, minimal diagram)
   - `docs/architecture-diagram-full.mmd` (Full diagram)
3. Copy the content and paste into Mermaid Live Editor
4. Click "Actions" → "Download PNG" or "Download SVG"

### Option 2: VS Code Extension

1. Install the "Markdown Preview Mermaid Support" extension
2. Open the `.mmd` file
3. Preview and export as image

### Option 3: Command Line (mermaid-cli)

```bash
# Install mermaid-cli globally
npm install -g @mermaid-js/mermaid-cli

# Generate minimal diagram
mmdc -i docs/architecture-diagram-minimal.mmd -o docs/architecture-diagram-minimal.png -w 1920 -H 1080

# Generate full diagram
mmdc -i docs/architecture-diagram-full.mmd -o docs/architecture-diagram-full.png -w 1920 -H 1080

# Generate SVG versions
mmdc -i docs/architecture-diagram-minimal.mmd -o docs/architecture-diagram-minimal.svg
mmdc -i docs/architecture-diagram-full.mmd -o docs/architecture-diagram-full.svg
```

### Option 4: GitHub (Auto-rendering)

- Push the `.mmd` files to GitHub
- GitHub will auto-render Mermaid diagrams in markdown files
- View and download as needed

## Which Diagram to Use for Submission?

### Recommended: Minimal Diagram
- **File**: `docs/architecture-diagram-minimal.mmd`
- **Why**: Clear and simple, easy to understand
- **Shows**: Cloud Run Service, Gemini Pro integration

### Alternative: Full Diagram
- **File**: `docs/architecture-diagram-full.mmd`
- **Why**: Shows complete architecture with all services
- **Shows**: All components including Pub/Sub, BigQuery, Cloud Storage, Cloud Run Jobs

## Diagram Files

1. **architecture-diagram-minimal.mmd** - Simple minimal diagram
2. **architecture-diagram-full.mmd** - Full architecture diagram
3. **architecture-diagram.mmd** - Original detailed diagram

## Tips for Submission

1. **Use PNG format** for the submission (widely supported)
2. **High resolution**: 1920x1080 or higher for clarity
3. **Clear labels**: All components should be clearly labeled
4. **Technology stack visible**: Show which technologies are used
5. **Flow arrows**: Show how data flows between components

## Preview in Browser

If you have a local web server, you can create an HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>mermaid.initialize({startOnLoad:true});</script>
</head>
<body>
    <h1>Minimal Architecture Diagram</h1>
    <div class="mermaid">
        <!-- Paste content from architecture-diagram-minimal.mmd here -->
    </div>
</body>
</html>
```

## For Hackathon Submission

The submission requires:
- ✅ **An Architecture Diagram** showing:
  - Which technologies were used
  - How they interact with one another

The minimal diagram clearly shows:
- ✅ Cloud Run Service (deployment requirement)
- ✅ Frontend (React/Vite)
- ✅ Backend API (FastAPI)
- ✅ Gemini Pro (Google AI Studio integration)
- ✅ Data flow between components

This meets the submission requirements!

