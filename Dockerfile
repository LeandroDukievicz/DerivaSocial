# alpine: base pequena e já presente na VPS (reaproveita a camada existente ~230MB)
FROM node:22-alpine

WORKDIR /app

# Instala dependências primeiro (melhor cache)
COPY package.json ./
RUN npm install --no-audit --no-fund

# Código
COPY tsconfig.json ./
COPY src ./src

# Estado persistente (montado via volume no compose)
RUN mkdir -p /app/data

# Sem portas expostas: o worker é 100% saída (RSS, APIs, long-poll do Telegram)
CMD ["npm", "start"]
