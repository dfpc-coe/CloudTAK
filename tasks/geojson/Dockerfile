FROM ubuntu:22.04

ENV HOME=/home/etl
WORKDIR $HOME

RUN apt-get update \
    && apt-get install -y curl build-essential

RUN export NODEV='19.8.1' \
    && curl "https://nodejs.org/dist/v${NODEV}/node-v${NODEV}-linux-x64.tar.gz" | tar -xzv > /dev/null \
    && cp ./node-v${NODEV}-linux-x64/bin/node /usr/bin/ \
    && ./node-v${NODEV}-linux-x64/bin/npm install -g npm

COPY ./ $HOME/task
WORKDIR $HOME/task

RUN npm install

CMD npm start
