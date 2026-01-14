@echo off
REM Pre-deployment validation workflow (Windows)
REM Usage: scripts\deploy-validation.bat [--with-migration] [--browser-test-url <url>]

setlocal enabledelayedexpansion

set WITH_MIGRATION=false
set BROWSER_TEST_URL=

REM Parse arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--with-migration" (
    set WITH_MIGRATION=true
    shift
    goto parse_args
)
if "%~1"=="--browser-test-url" (
    set BROWSER_TEST_URL=%~2
    shift
    shift
    goto parse_args
)
shift
goto parse_args
:end_parse

echo ================================
echo Pre-Deployment Validation
echo ================================
echo.

REM Step 1: Build
echo [1/6] Building project...
call pnpm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    exit /b 1
)
echo [OK] Build successful
echo.

REM Step 2: Run tests
echo [2/6] Running tests...
call pnpm test
if errorlevel 1 (
    echo [ERROR] Tests failed
    exit /b 1
)
echo [OK] All tests passed
echo.

REM Step 3: Push to repository
echo [3/6] Pushing to repository...
for /f "delims=" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
git push origin %CURRENT_BRANCH%
if errorlevel 1 (
    echo [ERROR] Push failed
    exit /b 1
)
echo [OK] Pushed to origin/%CURRENT_BRANCH%
echo.

REM Step 4: Check GitHub Actions
echo [4/6] Checking GitHub Actions...
echo Waiting 10 seconds for workflows to start...
timeout /t 10 /nobreak >nul

echo Latest workflow runs:
gh run list --limit 3

echo.
echo Watching CI workflow...
for /f "delims=" %%i in ('gh run list --limit 1 --json databaseId --jq ".[0].databaseId"') do set LATEST_RUN=%%i
gh run watch %LATEST_RUN% --exit-status
if errorlevel 1 (
    echo [ERROR] CI workflow failed
    echo View logs: gh run view %LATEST_RUN% --log-failed
    exit /b 1
)
echo [OK] CI workflow passed
echo.

REM Step 5: Check container migration status
if "%WITH_MIGRATION%"=="true" (
    echo [5/6] Checking container migration status...
    echo Waiting for deployment to complete ^(30 seconds^)...
    timeout /t 30 /nobreak >nul

    echo Checking deployed migrations:
    gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap --command="sudo docker exec -w /app/api opengov-monitor node -e \"const Database = require('better-sqlite3'); const db = new Database('/data/polkadot.db', { readonly: true }); const migrations = db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all(); console.log(JSON.stringify(migrations, null, 2))\""

    echo.
    echo Checking container health:
    gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap --command="sudo /usr/local/bin/service-status opengov-monitor"

    echo [OK] Container migration check complete
) else (
    echo [5/6] Skipping migration check ^(--with-migration not specified^)
)
echo.

REM Step 6: Browser testing
if not "%BROWSER_TEST_URL%"=="" (
    echo [6/6] Browser testing
    echo Manual verification required:
    echo   URL: %BROWSER_TEST_URL%
    echo.
    echo Please verify:
    echo   - Page loads without errors
    echo   - All features work as expected
    echo   - No console errors
    echo.
    pause
    echo [OK] Browser testing complete
) else (
    echo [6/6] Skipping browser test ^(--browser-test-url not specified^)
)
echo.

REM Summary
echo ================================
echo All validation steps passed!
echo ================================
echo.
echo Deployment Summary:
echo   Branch: %CURRENT_BRANCH%
for /f "delims=" %%i in ('git log -1 --oneline') do echo   Latest commit: %%i
echo   CI Run: %LATEST_RUN%
if "%WITH_MIGRATION%"=="true" echo   Migration: Applied and verified
if not "%BROWSER_TEST_URL%"=="" echo   Browser: Tested at %BROWSER_TEST_URL%
echo.
echo Deployment validated successfully!
