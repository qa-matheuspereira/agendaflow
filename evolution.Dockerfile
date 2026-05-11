FROM atendai/evolution-api:v1.8.7

# Patch: allow sending to @lid contacts (bypass isOnWhatsApp validation for @lid JIDs)
# Only the critical one-line change - avoids file corruption from large COPY
RUN sed -i "s/!isWA\.jid\.includes('@broadcast'))/!isWA.jid.includes('@broadcast') \&\& !isWA.jid.includes('@lid'))/g" \
    /evolution/dist/src/api/services/channels/whatsapp.baileys.service.js \
    && grep -c "@lid" /evolution/dist/src/api/services/channels/whatsapp.baileys.service.js
