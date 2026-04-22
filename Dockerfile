FROM node:24-alpine AS web-build

WORKDIR /workspace
COPY web/package.json web/package-lock.json /workspace/web/
RUN cd /workspace/web && npm install
COPY web/ /workspace/web/
RUN cd /workspace/web && npm run build

FROM node:24-alpine AS admin-build

WORKDIR /workspace
COPY admin/package.json /workspace/admin/package.json
RUN cd /workspace/admin && npm install
COPY admin/ /workspace/admin/
RUN cd /workspace/admin && npm run build

FROM nginx:1.27-alpine AS web

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/web-entrypoint.sh /docker-entrypoint.d/40-write-env.sh
COPY --from=web-build /workspace/web/dist /usr/share/nginx/html
RUN chmod +x /docker-entrypoint.d/40-write-env.sh
EXPOSE 80

FROM node:24-alpine AS admin

WORKDIR /app
COPY admin/package.json /app/package.json
RUN npm install --omit=dev
COPY --from=admin-build /workspace/admin/dist/client /app/dist/client
COPY --from=admin-build /workspace/admin/dist/server /app/dist/server
EXPOSE 8787
CMD ["node", "dist/server/index.js"]
