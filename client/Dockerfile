# syntax=docker/dockerfile:1.7

############################
# 1️⃣  deps  – install once
############################
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
COPY package.json yarn.lock ./

# cache Yarn’s global folder – survives between builds
RUN --mount=type=cache,id=yarn,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile

############################
# 2️⃣  tester  – Vitest only
############################
FROM deps AS tester
WORKDIR /app
COPY . .

ENV NODE_ENV=test
# Vitest exits with non-zero on failure → build fails
CMD ["yarn", "test"]

############################
# 3️⃣  builder – Next.js
############################
FROM deps AS builder
WORKDIR /app
COPY . .

# ---- build-time env ----
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_SCHEMA
ARG INTERNAL_API_BASE
ARG NEXT_PUBLIC_CUSTOM_VOICE
ARG NEXT_PUBLIC_STATSIG_CLIENT_KEY


ENV \
  NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  NEXT_PUBLIC_SUPABASE_SCHEMA=$NEXT_PUBLIC_SUPABASE_SCHEMA \
  INTERNAL_API_BASE=$INTERNAL_API_BASE \
  NEXT_PUBLIC_CUSTOM_VOICE=$NEXT_PUBLIC_CUSTOM_VOICE \
  NEXT_PUBLIC_STATSIG_CLIENT_KEY=$NEXT_PUBLIC_STATSIG_CLIENT_KEY \
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1

# Build with cache for the Next.js compiler
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    yarn build

############################
# 4️⃣  runtime – 17 MB 😎
############################
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1


# minimal utilities + non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs && \
    apk add --no-cache curl

# copy the standalone server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public         ./public

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]