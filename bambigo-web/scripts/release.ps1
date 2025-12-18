# Release Workflow Script
# Usage: ./scripts/release.ps1 "Commit Message"

param (
    [string]$message = "chore: update code"
)

Write-Host "🚀 Starting Release Workflow..." -ForegroundColor Cyan

# 1. Run Type Check
Write-Host "🔍 Running Type Check..." -ForegroundColor Yellow
npm run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Type Check Failed!" -ForegroundColor Red
    exit 1
}

# 2. Run Tests
Write-Host "🧪 Running Tests..." -ForegroundColor Yellow
npm run test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tests Failed!" -ForegroundColor Red
    exit 1
}

# 3. Git Operations
Write-Host "📦 Committing changes..." -ForegroundColor Yellow
git add .
git commit -m "$message"

Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Release Completed Successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Push Failed!" -ForegroundColor Red
    exit 1
}
