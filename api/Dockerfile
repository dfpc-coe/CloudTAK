# https://hub.docker.com/_/nginx
FROM nginx:alpine3.22

EXPOSE 5000

ENV HOME=/home/etl
WORKDIR $HOME

# Data source configuration
ARG DATA_SOURCE_URL=https://github.com/dfpc-coe/CloudTAK-Data/archive/refs/tags/v1.1.0.zip
ARG USE_S3=false

RUN apk add --no-cache git nodejs-current npm memcached python3 make bash g++ openssl postgresql-client grep wget unzip awscli

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
    && if [ "$USE_S3" = "true" ]; then \
        aws s3 cp "$DATA_SOURCE_URL" data.zip; \
    else \
        wget -O data.zip "$DATA_SOURCE_URL"; \
    fi \
    && unzip data.zip \
    && mv CloudTAK-Data-*/. dist/data/ \
    && rm -rf data.zip CloudTAK-Data-*

CMD ["./start"]
