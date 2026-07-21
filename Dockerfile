# Stage 1 : build du frontend React/Vite
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2 : image finale (backend Flask + frontend statique)
FROM python:3.12-alpine
WORKDIR /app

RUN apk add --no-cache sqlite-libs

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend-dist

RUN mkdir -p uploads

ENV FRONTEND_DIR=/app/frontend-dist
ENV SECRET_KEY=change-me-in-production

EXPOSE 5000

CMD ["gunicorn", "--preload", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "app:app"]
