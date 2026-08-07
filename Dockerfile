FROM node:20-alpine AS build

WORKDIR /app

COPY web/package*.json ./web/
RUN cd web && npm ci

COPY web ./web
RUN cd web && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
