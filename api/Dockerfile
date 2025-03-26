FROM nginx:alpine3.21

EXPOSE 5000

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add git nodejs-current npm memcached python3 make bash g++ openssl postgresql-client grep

WORKDIR $HOME/api

ADD package.json ./
ADD package-lock.json ./

RUN git clone --branch v1.1.0 --depth 1 https://github.com/dfpc-coe/CloudTAK-Data.git data

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
    && mv data dist/

CMD ["./start"]
