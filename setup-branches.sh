#!/bin/bash
echo "Setting up staging and production branches..."

# Frontend repo
cd /Users/abdulqadeer/Desktop/oil-erp-frontend-

# Make sure we are on main and up to date
git checkout main
git pull origin main

# Create develop branch if it does not exist
git checkout -b develop 2>/dev/null || git checkout develop

# Push develop branch to GitHub
git push -u origin develop

echo "Frontend: develop branch created and pushed"

# Switch back to main for production stability
git checkout main

echo ""
echo "DONE. Frontend branches:"
echo "  main    → soltol.com (production)"
echo "  develop → app.soltol.com (staging)"
echo ""
echo "NOW do the same for backend manually:"
echo "  cd /Users/abdulqadeer/Desktop/bettano-erp-backend"
echo "  git checkout main"
echo "  git pull origin main"
echo "  git checkout -b develop"
echo "  git push -u origin develop"
