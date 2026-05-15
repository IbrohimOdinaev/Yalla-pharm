FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG INTERNAL_API_URL=http://localhost:5000
ARG NEXT_PUBLIC_YANDEX_MAPS_API_KEY=
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV NEXT_PUBLIC_YANDEX_MAPS_API_KEY=$NEXT_PUBLIC_YANDEX_MAPS_API_KEY
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Drop privileges in the runner stage — see yalla-back/Dockerfile for
# rationale. The alpine base already has a `node` user/group (uid 1000)
# but we mint our own fixed `nextjs` to match the playbook's convention
# of one explicit non-root identity per image.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs --shell /sbin/nologin nextjs

# Files arrive owned by nextjs:nodejs so the runtime never needs write
# access on /app contents — it only writes to .next/cache (which Next
# tries to populate at first request) and we'll just let that fail
# silently; the cache is best-effort.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]
