# Imagem oficial do Node (leve e compatível com Cloud Run)
FROM node:20-alpine

# Diretório de trabalho dentro do container
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências
RUN npm install --production

# Copia o restante do código
COPY . .

# Cloud Run usa a variável PORT
ENV PORT=8080

# Expõe a porta (documentação)
EXPOSE 8080

# Comando de start
CMD ["node", "index.js"]

