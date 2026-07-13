FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci

FROM dependencies AS builder
COPY . .
ARG NEXT_PUBLIC_BUSINESS_EMAIL=hello@whatisthis.place
ARG NEXT_PUBLIC_WHATSAPP_URL
ARG NEXT_PUBLIC_MESSENGER_URL
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_BUSINESS_EMAIL=${NEXT_PUBLIC_BUSINESS_EMAIL} \
    NEXT_PUBLIC_WHATSAPP_URL=${NEXT_PUBLIC_WHATSAPP_URL} \
    NEXT_PUBLIC_MESSENGER_URL=${NEXT_PUBLIC_MESSENGER_URL}
RUN npm run build

FROM dependencies AS migrator
COPY . .
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:22-bookworm-slim AS reminder-worker
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node apps/web/scripts/reminder-worker.mjs ./reminder-worker.mjs
USER node
CMD ["node", "reminder-worker.mjs"]
