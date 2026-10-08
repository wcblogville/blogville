# Blogville 서버 이미지. GitHub Actions(.github/workflows/deploy.yml)가 만들어 서버로 보낸다.
# 앱(npm start)과 DB 준비 명령(db:migrate:deploy·db:seed·admin:create)을 같은 이미지에서 실행할 수 있게
# node_modules와 scripts를 함께 담는다.
FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Turbopack 빌드는 한글이 든 코드 위치 표시에서 멈추는 문제가 있어 webpack으로 빌드한다
RUN npx next build --webpack

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/storage/uploads
EXPOSE 3000
CMD ["npm", "start"]
