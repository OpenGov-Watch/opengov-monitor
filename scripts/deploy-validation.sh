#!/bin/bash
# Pre-deployment validation workflow
# Usage: ./scripts/deploy-validation.sh [--with-migration] [--browser-test-url <url>]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
WITH_MIGRATION=false
BROWSER_TEST_URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --with-migration)
      WITH_MIGRATION=true
      shift
      ;;
    --browser-test-url)
      BROWSER_TEST_URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Pre-Deployment Validation${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Step 1: Build
echo -e "${YELLOW}[1/6] Building project...${NC}"
pnpm run build
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Build successful${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  exit 1
fi
echo ""

# Step 2: Run tests
echo -e "${YELLOW}[2/6] Running tests...${NC}"
pnpm test
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  exit 1
fi
echo ""

# Step 3: Push to repository
echo -e "${YELLOW}[3/6] Pushing to repository...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
git push origin "$CURRENT_BRANCH"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Pushed to origin/$CURRENT_BRANCH${NC}"
else
  echo -e "${RED}✗ Push failed${NC}"
  exit 1
fi
echo ""

# Step 4: Check GitHub Actions
echo -e "${YELLOW}[4/6] Checking GitHub Actions...${NC}"
echo "Waiting 10 seconds for workflows to start..."
sleep 10

echo "Latest workflow runs:"
gh run list --limit 3

echo ""
echo "Watching CI workflow..."
LATEST_RUN=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$LATEST_RUN" --exit-status

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ CI workflow passed${NC}"
else
  echo -e "${RED}✗ CI workflow failed${NC}"
  echo "View logs: gh run view $LATEST_RUN --log-failed"
  exit 1
fi
echo ""

# Step 5: Check container migration status (if applicable)
if [ "$WITH_MIGRATION" = true ]; then
  echo -e "${YELLOW}[5/6] Checking container migration status...${NC}"

  echo "Waiting for deployment to complete (30 seconds)..."
  sleep 30

  echo "Checking deployed migrations:"
  gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
    --command="sudo docker exec -w /app/api opengov-monitor node -e \"const Database = require('better-sqlite3'); const db = new Database('/data/polkadot.db', { readonly: true }); const migrations = db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all(); console.log(JSON.stringify(migrations, null, 2))\""

  echo ""
  echo "Checking container health:"
  gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
    --command="sudo /usr/local/bin/service-status opengov-monitor"

  echo -e "${GREEN}✓ Container migration check complete${NC}"
else
  echo -e "${YELLOW}[5/6] Skipping migration check (--with-migration not specified)${NC}"
fi
echo ""

# Step 6: Browser testing
if [ -n "$BROWSER_TEST_URL" ]; then
  echo -e "${YELLOW}[6/6] Browser testing${NC}"
  echo "Manual verification required:"
  echo "  URL: $BROWSER_TEST_URL"
  echo ""
  echo "Please verify:"
  echo "  - Page loads without errors"
  echo "  - All features work as expected"
  echo "  - No console errors"
  echo ""
  read -p "Press Enter once you've verified the page works correctly..."
  echo -e "${GREEN}✓ Browser testing complete${NC}"
else
  echo -e "${YELLOW}[6/6] Skipping browser test (--browser-test-url not specified)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✓ All validation steps passed!${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "Deployment Summary:"
echo "  Branch: $CURRENT_BRANCH"
echo "  Latest commit: $(git log -1 --oneline)"
echo "  CI Run: $LATEST_RUN"
if [ "$WITH_MIGRATION" = true ]; then
  echo "  Migration: Applied and verified"
fi
if [ -n "$BROWSER_TEST_URL" ]; then
  echo "  Browser: Tested at $BROWSER_TEST_URL"
fi
echo ""
echo "🎉 Deployment validated successfully!"
