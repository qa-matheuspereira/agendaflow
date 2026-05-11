FROM atendai/evolution-api:v1.8.7

# Apply baileys service patch (fixes @lid handling and other local customizations)
COPY patches/whatsapp.baileys.service.js /evolution/dist/src/api/services/channels/whatsapp.baileys.service.js
