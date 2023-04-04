FROM nginx:stable-alpine3.17

EXPOSE 5000

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add nodejs-current npm memcached python3 make bash g++

WORKDIR $HOME/api

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY ./ $HOME/api

RUN npm run doc

RUN cd web \
    && npm install \
    && npm install -g yarn \
    && yarn prod \
    && cd ..

CMD memcached -d -u root \
    && nginx \
    && npx knex migrate:latest \
    && npm run prod
