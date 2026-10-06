FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json* bun.lock* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apk add --no-cache curl tzdata
ENV TZ=Asia/Damascus
RUN cp /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 orcaapp

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./index.html

# ✅ [Hotfix] Copy shared src files needed by server (parcelMergeEngine, 
# interBranchHelpers, types, etc.)
COPY --from=builder /app/src/utils ./src/utils
COPY --from=builder /app/src/types.ts ./src/types.ts

RUN mkdir -p /app/vps-data && chown -R orcaapp:nodejs /app
USER orcaapp
EXPOSE 3000

CMD ["npm", "start"]
