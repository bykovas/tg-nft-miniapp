<#
.SYNOPSIS
Registers or updates Telegram webhook for Bykovas NFT Mini App.

.DESCRIPTION
This script safely calls the Telegram Bot API /setWebhook method.
It does NOT store any secrets in the repository — you provide them interactively
or via parameters / environment variables.

.EXAMPLE
PS> .\scripts\register-webhook.ps1 -BotToken "1234567890:AA..." -Secret "aF93kd_Secret_Bykovas_TG"

.EXAMPLE
PS> $env:TG_BOT_TOKEN="1234567890:AA..."
PS> $env:TG_WEBHOOK_SECRET="aF93kd_Secret_Bykovas_TG"
PS> .\scripts\register-webhook.ps1
#>

param(
    [Parameter(Mandatory = $false)]
    [string] $BotToken = $env:TG_BOT_TOKEN,

    [Parameter(Mandatory = $false)]
    [string] $Secret   = $env:TG_WEBHOOK_SECRET,

    [Parameter(Mandatory = $false)]
    [string] $WebhookUrl = "https://api.tg-nft.bykovas.lt/tg/webhook"
)

# Ask interactively if not provided
if (-not $BotToken) {
    $BotToken = Read-Host "Enter your Telegram Bot Token (from @BotFather)"
}
if (-not $Secret) {
    $Secret = Read-Host "Enter your TG_WEBHOOK_SECRET (must match Cloudflare secret)"
}

Write-Host "-------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Registering webhook for Telegram bot..." -ForegroundColor Cyan
Write-Host "URL: $WebhookUrl" -ForegroundColor DarkGray
Write-Host "-------------------------------------------------------------" -ForegroundColor Cyan

$body = @{
    url                  = $WebhookUrl
    secret_token         = $Secret
    drop_pending_updates = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BotToken/setWebhook" `
        -Method Post -ContentType "application/json" -Body $body
    Write-Host "✅ Webhook response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "❌ Error setting webhook: $_" -ForegroundColor Red
}
