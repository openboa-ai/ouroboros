FROM node:24-bookworm-slim AS deps

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json vitest.config.ts ./
COPY apps/runtime/package.json apps/runtime/package.json
COPY apps/operator-web/package.json apps/operator-web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/local-store/package.json packages/local-store/package.json

RUN npm ci

COPY . .

FROM deps AS runtime

ENV HOST=0.0.0.0
ENV PORT=4173
ENV OUROBOROS_STORE_ROOT=/data/ouroboros-store

EXPOSE 4173

CMD ["npm", "run", "start", "-w", "@ouroboros/runtime"]

FROM deps AS operator-web

ENV HOST=0.0.0.0
ENV PORT=5173
ENV VITE_OUROBOROS_RUNTIME_URL=http://127.0.0.1:4173

EXPOSE 5173

CMD ["npm", "run", "dev", "-w", "@ouroboros/operator-web"]

FROM deps AS validation

ENV OUROBOROS_STORE_ROOT=/tmp/ouroboros-store

CMD ["npm", "test"]
