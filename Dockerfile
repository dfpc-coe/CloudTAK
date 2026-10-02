FROM alpine:3.24 AS data

ARG DATA_SOURCE_URL=https://github.com/dfpc-coe/CloudTAK-Data/archive/refs/tags/v1.2.0.zip
ARG USE_LOCAL_ZIP=false

WORKDIR /tmp/data

COPY api/data.zip* ./

RUN if [ "$USE_LOCAL_ZIP" != "true" ]; then wget -O data.zip "$DATA_SOURCE_URL"; fi \
    && unzip data.zip \
    && mkdir /data \
    && cp -r CloudTAK-Data-*/* /data/

# https://hub.docker.com/_/nginx
FROM nginx:alpine3.24

EXPOSE 5000

ENV HOME=/home/etl
WORKDIR $HOME

ARG API_URL
ARG WEB_PLUGINS

RUN apk add --no-cache git nodejs-current npm python3 make bash g++ openssl postgresql-client grep wget unzip perf

WORKDIR $HOME/api

ADD api/package.json ./
ADD api/package-lock.json ./

RUN npm install

WORKDIR $HOME/app

ADD app/package.json ./
ADD app/package-lock.json ./

RUN npm install

COPY api/ $HOME/api/
COPY app/ $HOME/app/

WORKDIR $HOME/api

RUN WEB_PLUGINS="$WEB_PLUGINS" node bin/plugin.ts

RUN cd ../app \
    && npm run lint \
    && npm run check \
    && npm run build

RUN npm run lint \
    && npm run build

COPY --from=data /data/ dist/data/

CMD ["./start"]
