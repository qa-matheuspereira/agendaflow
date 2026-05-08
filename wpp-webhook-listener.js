const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 9999;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    res.writeHead(200);
    res.end('ok');

    try {
      const payload = JSON.parse(body);
      const event = payload.event || payload.type;
      console.log(`EVENT: ${event} session=${payload.session}`);

      if (event === 'qrcode' || (payload.data && payload.data.qrcode)) {
        const qr = payload.qrcode || (payload.data && payload.data.qrcode);
        if (qr && qr.length > 10) {
          console.log('QR CODE RECEIVED! Saving to browser...');
          const html = `<!DOCTYPE html>
<html><head><title>WPPConnect QR</title>
<meta http-equiv="refresh" content="5">
</head>
<body style="background:#111;display:flex;justify-content:center;flex-direction:column;align-items:center;height:100vh;margin:0">
<h2 style="color:white;font-family:sans-serif">Escaneie com WhatsApp</h2>
<img src="${qr}" style="width:300px;height:300px;border:4px solid #25D366"/>
<p style="color:#aaa;font-family:sans-serif">WhatsApp &gt; Dispositivos vinculados &gt; Vincular</p>
</body></html>`;
          const htmlPath = path.join(os.tmpdir(), 'wpp-qr.html');
          fs.writeFileSync(htmlPath, html, 'utf8');
          console.log(`HTML saved to: ${htmlPath}`);
          // Print QR length so user knows it was received
          console.log(`QR data length: ${qr.length} chars`);
        }
      }
    } catch(e) {
      // Not JSON or parse error — log raw (truncated)
      console.log(`RAW (${body.length} bytes): ${body.substring(0, 200)}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Webhook listener running on http://localhost:${PORT}`);
  console.log('Waiting for WPPConnect events...');
  console.log('Open C:\\Users\\Matheus\\AppData\\Local\\Temp\\wpp-qr.html in browser after QR arrives');
});
