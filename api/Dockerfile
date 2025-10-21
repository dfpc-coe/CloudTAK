# https://hub.docker.com/_/nginx
FROM nginx:alpine3.22

EXPOSE 5000

ENV HOME=/home/etl
WORKDIR $HOME

# Data source configuration
ARG DATA_SOURCE_URL=https://github.com/dfpc-coe/CloudTAK-Data/archive/refs/tags/v1.1.0.zip
ARG API_URL
ARG USE_LOCAL_ZIP=false

RUN apk add --no-cache git nodejs-current npm python3 make bash g++ openssl postgresql-client grep wget unzip

WORKDIR $HOME/api

ADD package.json ./
ADD package-lock.json ./

RUN npm install

COPY ./ $HOME/api

RUN cd web \
    && npm install \
    && npm run lint \
    && npm run check \
    && npm run build \
    && cd ..

RUN npm run lint \
    && npm run build \
    && if [ "$USE_LOCAL_ZIP" = "true" ]; then \
        cp data.zip data.zip.tmp; \
    else \
        wget -O data.zip.tmp "$DATA_SOURCE_URL"; \
    fi \
    && unzip data.zip.tmp \
    && mkdir -p dist/data \
    && cp -r CloudTAK-Data-*/* dist/data/ \
    && rm -rf data.zip.tmp CloudTAK-Data-*

CMD ["./start"]
