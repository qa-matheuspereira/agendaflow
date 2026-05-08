# Escaneia QR do WPPConnect e abre no browser
# Uso: .\wpp-qr.ps1 [session]
# Gera token automaticamente via secretKey

$session  = if ($args[0]) { $args[0] } else { 'tenant_demo' }
$secret   = 'THISISMYSECURETOKEN'
$base     = 'http://localhost:21465'

Write-Host "Gerando token para sessao: $session" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Method POST -Uri "$base/api/$session/$secret/generate-token" -ErrorAction Stop
    $token = $r.token
    Write-Host "Token: $token" -ForegroundColor Gray
} catch {
    Write-Host "Erro ao gerar token: $_" -ForegroundColor Red
    exit 1
}

$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

Write-Host "Iniciando sessao..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Method POST -Uri "$base/api/$session/start-session" `
        -Headers $headers -Body '{"autoClose": 300000}' -ErrorAction Stop | Out-Null
} catch {
    Write-Host "Aviso start-session (continuando): $_" -ForegroundColor Yellow
}

Write-Host "Aguardando QR code (status-session, ate 5 min)..." -ForegroundColor Yellow

$qrObtido = $false
for ($i = 0; $i -lt 100; $i++) {
    Start-Sleep -Seconds 3
    try {
        $resp = Invoke-RestMethod -Method GET -Uri "$base/api/$session/status-session" `
            -Headers $headers -ErrorAction SilentlyContinue
    } catch {
        Write-Host "[$i] erro: $_" -ForegroundColor Gray
        continue
    }

    $status = $resp.status
    $qr = $resp.qrcode
    Write-Host "[$i] status=$status qr=$(if($qr.Length -gt 10){'SIM('+$qr.Length+'chars)'}else{'nao'})" -NoNewline

    if ($status -eq 'CONNECTED' -or $status -eq 'INSERVICE') {
        Write-Host " - Ja conectado!" -ForegroundColor Green
        Write-Host "Token ativo: $token" -ForegroundColor Cyan
        $qrObtido = $true
        break
    }

    if ($status -eq 'QRCODE' -and $qr -and $qr.Length -gt 100) {
        Write-Host " - QR disponivel!" -ForegroundColor Green

        $html = @"
<!DOCTYPE html>
<html><head><title>WPPConnect QR</title><meta http-equiv="refresh" content="30"></head>
<body style="background:#111;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0">
<h2 style="color:#25D366;font-family:sans-serif">Escaneie com o WhatsApp</h2>
<img src="$qr" style="width:350px;height:350px;border:4px solid #25D366;border-radius:8px"/>
<p style="color:#aaa;font-family:sans-serif">WhatsApp &gt; Dispositivos vinculados &gt; Vincular dispositivo</p>
<p style="color:#666;font-family:sans-serif;font-size:12px">Auto-refresh a cada 30s | Sessao: $session</p>
</body></html>
"@
        $htmlPath = "$env:TEMP\wpp-qr.html"
        $html | Out-File -FilePath $htmlPath -Encoding utf8
        Start-Process $htmlPath
        Write-Host "QR aberto no browser. Escaneie agora!" -ForegroundColor Green
        $qrObtido = $true

        # Aguarda confirmacao
        Write-Host "Aguardando scan..." -ForegroundColor Yellow
        for ($j = 0; $j -lt 40; $j++) {
            Start-Sleep -Seconds 3
            try {
                $st = Invoke-RestMethod -Method GET -Uri "$base/api/$session/status-session" `
                    -Headers $headers -ErrorAction SilentlyContinue
                # Refresh QR se novo
                if ($st.qrcode -and $st.qrcode.Length -gt 100 -and $st.qrcode -ne $qr) {
                    $qr = $st.qrcode
                    $html = $html -replace 'src="[^"]*"', "src=`"$qr`""
                    $html | Out-File -FilePath $htmlPath -Encoding utf8
                }
            } catch { continue }
            $st2 = $resp.status
            if ($st.status -eq 'CONNECTED' -or $st.status -eq 'INSERVICE') {
                Write-Host "CONECTADO! Sessao $session autenticada." -ForegroundColor Green
                Write-Host ""
                Write-Host "Token para salvar no banco (whatsapp_configs.instance_key):" -ForegroundColor Cyan
                Write-Host $token -ForegroundColor White
                exit 0
            }
            Write-Host "Aguardando scan... ($j) status=$($st.status)" -ForegroundColor Gray
        }
        Write-Host "Timeout do scan." -ForegroundColor Red
        break
    }

    Write-Host " - aguardando..." -ForegroundColor Gray
}

if (-not $qrObtido) {
    Write-Host "QR nao apareceu. Logs: docker logs agendaflow_wppconnect --tail 20" -ForegroundColor Red
    exit 1
}
