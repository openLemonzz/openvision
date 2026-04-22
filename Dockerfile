FROM node:24-alpine AS app-base

WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci

FROM app-base AS web-build

COPY app/ ./
RUN npm run build

FROM app-base AS init

RUN npm install supabase@2.90.0 && ln -s /app/node_modules/.bin/supabase /usr/local/bin/supabase
COPY app/ ./
COPY docker/init-entrypoint.sh /usr/local/bin/init-entrypoint.sh
RUN chmod +x /usr/local/bin/init-entrypoint.sh
CMD ["sh", "/usr/local/bin/init-entrypoint.sh"]

FROM nginx:1.27-alpine AS web

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/web-entrypoint.sh /docker-entrypoint.d/40-write-env.sh
COPY --from=web-build /app/dist /usr/share/nginx/html
RUN chmod +x /docker-entrypoint.d/40-write-env.sh
EXPOSE 80
