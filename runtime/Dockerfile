FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a
LABEL org.opencontainers.image.source="https://github.com/Bacon0033/homepute-terraria-dashboard-unit" \
      org.opencontainers.image.description="Terraria dashboard add-on for Homepute" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY server.mjs panel.html /app/
EXPOSE 3000/tcp
USER node
ENTRYPOINT ["node", "/app/server.mjs"]
