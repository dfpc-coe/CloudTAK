FROM alpine:3.22

EXPOSE 5002

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add git nodejs-current npm

WORKDIR $HOME/tiles

ADD package.json ./
ADD package-lock.json ./

RUN npm install

COPY ./ $HOME/tiles

RUN npm run lint \
    && npm run build

CMD ["npm", "run", "prod"]
