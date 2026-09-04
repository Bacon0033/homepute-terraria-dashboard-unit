FROM node:22-alpine@sha256:76789712cd1ae89a1225eac9077010d68987a423588042dac30446f502f1858c
WORKDIR /app
COPY server.mjs /app/server.mjs
EXPOSE 3000/tcp
USER node
ENTRYPOINT ["node", "/app/server.mjs"]
