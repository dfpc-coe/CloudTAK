FROM nginx:alpine3.19

EXPOSE 5000

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add nodejs-current npm memcached python3 make bash g++ openssl postgresql-client grep

WORKDIR $HOME/api

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY ./ $HOME/api

RUN cd web \
    && npm install \
    && npm run lint \
    && npm run check \
    && npm run build \
    && cd ..

RUN npm run lint \
    && npm run build

COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./start $HOME/api

CMD ["./start"]
