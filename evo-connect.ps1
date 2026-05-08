$EVO_URL  = "http://localhost:8080"
$EVO_KEY  = "agendaflow_evolution_key_2026"
$INSTANCE = "tenant_demo"
$WEBHOOK  = "http://host.docker.internal:3001/api/v1/whatsapp/webhook"

$headers = @{ "apikey" = $EVO_KEY; "Content-Type" = "application/json" }

Write-Host "==> Criando instancia $INSTANCE..."
$body = @{ instanceName = $INSTANCE; qrcode = $true; integration = "WHATSAPP-BAILEYS" } | ConvertTo-Json
try {
    $res = Invoke-RestMethod -Uri "$EVO_URL/instance/create" -Method POST -Headers $headers -Body $body
    Write-Host "Instancia criada: $($res | ConvertTo-Json -Depth 4)"
} catch {
    $msg = $_.Exception.Response.StatusCode
    if ($msg -eq 409 -or "$_" -match "409") {
        Write-Host "Instancia ja existe, continuando..."
    } else {
        Write-Host "Erro ao criar instancia: $_"
    }
}

Write-Host ""
Write-Host "==> Configurando webhook..."
$wbody = @{
    url    = $WEBHOOK
    webhook_by_events = $false
    events = @("MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE")
} | ConvertTo-Json
try {
    $wres = Invoke-RestMethod -Uri "$EVO_URL/webhook/set/$INSTANCE" -Method POST -Headers $headers -Body $wbody
    Write-Host "Webhook configurado: $($wres | ConvertTo-Json)"
} catch {
    Write-Host "Erro webhook: $_"
}

Write-Host ""
Write-Host "==> Buscando QR code..."
Start-Sleep -Seconds 2
try {
    $qr = Invoke-RestMethod -Uri "$EVO_URL/instance/connect/$INSTANCE" -Method GET -Headers $headers
    if ($qr.base64) {
        $b64 = $qr.base64 -replace "^data:image/png;base64,", ""
        $tmpFile = "$env:TEMP\evo_qr.png"
        [System.IO.File]::WriteAllBytes($tmpFile, [Convert]::FromBase64String($b64))
        Write-Host "QR salvo em: $tmpFile"
        Start-Process $tmpFile
    } elseif ($qr.qrcode) {
        Write-Host "QR (text):"
        Write-Host $qr.qrcode
    } else {
        Write-Host "Resposta connect: $($qr | ConvertTo-Json -Depth 4)"
    }
} catch {
    Write-Host "Erro QR: $_"
}

Write-Host ""
Write-Host "Escaneie o QR com o WhatsApp. Pressione Enter quando conectado..."
Read-Host

Write-Host "==> Status da instancia:"
try {
    $status = Invoke-RestMethod -Uri "$EVO_URL/instance/connectionState/$INSTANCE" -Method GET -Headers $headers
    Write-Host ($status | ConvertTo-Json -Depth 4)
} catch {
    Write-Host "Erro status: $_"
}
