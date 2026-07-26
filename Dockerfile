FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4480
ENV QELLY_DEVELOPMENT_IDENTITY_ENABLED=false
COPY package.json package-lock.json ./
COPY apps ./apps
COPY baseline ./baseline
COPY packages ./packages
COPY src ./src
COPY data ./data
COPY docs ./docs
COPY scripts ./scripts
COPY LICENSE NOTICE.md README.md SECURITY.md ./
RUN mkdir -p /app/runtime && chown -R node:node /app
USER node
EXPOSE 4480
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget -qO- http://127.0.0.1:4480/api/ready || exit 1
CMD ["node","src/server/server.mjs"]
