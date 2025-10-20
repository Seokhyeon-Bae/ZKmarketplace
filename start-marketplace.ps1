# ZK Marketplace Startup Script
# This script will help you start all components of the ZK Marketplace

Write-Host "🚀 Starting ZK Marketplace..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the zk-marketplace root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "🔧 Compiling smart contracts..." -ForegroundColor Yellow
npx hardhat compile

Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "1. Start Hardhat node: npx hardhat node" -ForegroundColor White
Write-Host "2. Deploy contracts: npx hardhat run scripts/deploy.js --network localhost" -ForegroundColor White
Write-Host "3. Start backend: cd backend && npm start" -ForegroundColor White
Write-Host "4. Start frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "🌐 The marketplace will be available at: http://localhost:3000" -ForegroundColor Green
Write-Host "📊 API will be available at: http://localhost:3001" -ForegroundColor Green





