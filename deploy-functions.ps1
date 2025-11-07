#!/usr/bin/env pwsh
# Script de Deploy das Cloud Functions
# Execute com: .\deploy-functions.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploy Cloud Functions - Firebase" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Firebase CLI está instalado
Write-Host "Verificando Firebase CLI..." -ForegroundColor Yellow
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue

if (-not $firebaseInstalled) {
    Write-Host "❌ Firebase CLI não está instalado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale com:" -ForegroundColor Yellow
    Write-Host "  npm install -g firebase-tools" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Firebase CLI encontrado" -ForegroundColor Green
Write-Host ""

# Instalar dependências das functions
Write-Host "Instalando dependências das functions..." -ForegroundColor Yellow
Set-Location functions
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..
Write-Host "✅ Dependências instaladas" -ForegroundColor Green
Write-Host ""

# Deploy
Write-Host "Fazendo deploy das functions..." -ForegroundColor Yellow
firebase deploy --only functions

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ Deploy concluído com sucesso!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Functions deployadas:" -ForegroundColor Cyan
    Write-Host "  • createUserWithProfile" -ForegroundColor White
    Write-Host "  • updateUserPassword" -ForegroundColor White
    Write-Host "  • toggleUserStatus" -ForegroundColor White
    Write-Host "  • deleteUser" -ForegroundColor White
    Write-Host ""
    Write-Host "Para ver logs:" -ForegroundColor Yellow
    Write-Host "  firebase functions:log" -ForegroundColor White
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "❌ Erro no deploy!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "  1. Se você está logado: firebase login" -ForegroundColor White
    Write-Host "  2. Se o projeto está correto: firebase use atendimento-f2f9f" -ForegroundColor White
    Write-Host "  3. Se o plano Blaze está ativo no Firebase" -ForegroundColor White
    Write-Host ""
    exit 1
}
