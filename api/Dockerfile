FROM nginx:alpine3.18

EXPOSE 5000

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add nodejs npm memcached python3 make bash g++ openssl postgresql-client

WORKDIR $HOME/api

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY ./ $HOME/api

RUN cd web \
    && npm install \
    && npm run build \
    && cd ..

RUN npm run build

COPY ./nginx.conf /etc/nginx/nginx.conf

CMD memcached -d -u root \
    && nginx \
    && npm run prod
