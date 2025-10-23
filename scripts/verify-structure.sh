#!/bin/bash
# Quick test script to verify the application structure

echo "=== Zero-Trust Explainer Structure Verification ==="
echo ""

echo "✓ Checking Backend Structure..."
test -f backend/main.py && echo "  ✓ Backend main.py exists"
test -f backend/requirements.txt && echo "  ✓ Backend requirements.txt exists"
test -f backend/Dockerfile && echo "  ✓ Backend Dockerfile exists"

echo ""
echo "✓ Checking Frontend Structure..."
test -f frontend/package.json && echo "  ✓ Frontend package.json exists"
test -f frontend/src/App.jsx && echo "  ✓ Frontend App.jsx exists"
test -f frontend/Dockerfile && echo "  ✓ Frontend Dockerfile exists"

echo ""
echo "✓ Checking Terraform Structure..."
test -f terraform/main.tf && echo "  ✓ Terraform main.tf exists"

echo ""
echo "✓ Checking Documentation..."
test -f README.md && echo "  ✓ README.md exists"
test -f CONTRIBUTING.md && echo "  ✓ CONTRIBUTING.md exists"
test -f docs/ARCHITECTURE.md && echo "  ✓ ARCHITECTURE.md exists"
test -f docs/DEPLOYMENT.md && echo "  ✓ DEPLOYMENT.md exists"

echo ""
echo "✓ Checking Configuration..."
test -f .github/workflows/deploy.yml && echo "  ✓ GitHub Actions workflow exists"
test -f docker-compose.yml && echo "  ✓ docker-compose.yml exists"
test -f .gitignore && echo "  ✓ .gitignore exists"

echo ""
echo "=== Verification Complete ==="
