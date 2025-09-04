# PowerShell script to test CC recipients feature with authentication

# Step 1: Login and get session cookie
Write-Host "🔐 Logging in..." -ForegroundColor Green
$loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{ "email": "Foreignadmits@gmail.com", "password": "FAFA@123@" }' -SessionVariable session

if ($loginResponse.StatusCode -eq 200) {
    Write-Host "✅ Login successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Login failed!" -ForegroundColor Red
    exit
}

# Step 2: Test settings API to verify CC recipients
Write-Host "`n📋 Testing settings API..." -ForegroundColor Green
$settingsResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/settings" -Method GET -WebSession $session

if ($settingsResponse.StatusCode -eq 200) {
    $settings = $settingsResponse.Content | ConvertFrom-Json
    Write-Host "✅ Settings retrieved successfully!" -ForegroundColor Green
    Write-Host "📧 CC Recipients: $($settings.ccRecipients)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to get settings!" -ForegroundColor Red
    Write-Host "Response: $($settingsResponse.Content)" -ForegroundColor Red
}

# Step 3: Get a recent batch ID for testing
Write-Host "`n📦 Getting recent batch for testing..." -ForegroundColor Green
$batchResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/batch/history" -Method GET -WebSession $session

if ($batchResponse.StatusCode -eq 200) {
    $batches = $batchResponse.Content | ConvertFrom-Json
    $recentBatch = $batches | Where-Object { $_.delivered -eq 0 } | Select-Object -First 1

    if ($recentBatch) {
        Write-Host "✅ Found recent batch: $($recentBatch.id)" -ForegroundColor Green
        $batchId = $recentBatch.id

        # Step 4: Generate emails for the batch
        Write-Host "`n🤖 Generating emails for batch..." -ForegroundColor Green
        $generateResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/batch/generate" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body "{ `"batchId`": `"$batchId`" }" -WebSession $session

        if ($generateResponse.StatusCode -eq 200) {
            $generateResult = $generateResponse.Content | ConvertFrom-Json
            Write-Host "✅ Email generation successful!" -ForegroundColor Green
            Write-Host "📧 Generated $($generateResult.generated) emails" -ForegroundColor Cyan

            # Step 5: Send emails with CC recipients
            Write-Host "`n📤 Sending emails with CC recipients..." -ForegroundColor Green
            $emailsJson = $generateResult.generatedEmails | ConvertTo-Json -Compress
            $sendResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/batch/send" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body "{ `"batchId`": `"$batchId`", `"generatedEmails`": $emailsJson }" -WebSession $session

            if ($sendResponse.StatusCode -eq 200) {
                $sendResult = $sendResponse.Content | ConvertFrom-Json
                Write-Host "✅ Email sending completed!" -ForegroundColor Green
                Write-Host "📊 Results: $($sendResult.delivered) delivered, $($sendResult.total) total" -ForegroundColor Cyan

                if ($sendResult.errors -and $sendResult.errors.Count -gt 0) {
                    Write-Host "⚠️  Errors encountered:" -ForegroundColor Yellow
                    $sendResult.errors | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
                }
            } else {
                Write-Host "❌ Email sending failed!" -ForegroundColor Red
                Write-Host "Response: $($sendResponse.Content)" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ Email generation failed!" -ForegroundColor Red
            Write-Host "Response: $($generateResponse.Content)" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ No recent batches found for testing!" -ForegroundColor Red
        Write-Host "💡 Please upload a CSV and process it first through the UI" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Failed to get batch history!" -ForegroundColor Red
    Write-Host "Response: $($batchResponse.Content)" -ForegroundColor Red
}

Write-Host "`n🎉 CC Recipients testing completed!" -ForegroundColor Green
