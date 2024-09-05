FROM ubuntu:24.04

ENV HOME=/home/etl
WORKDIR $HOME

RUN apt update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends apt-utils tzdata \
    && apt install -y build-essential curl cmake autoconf libtool

RUN export NODEV='22.8.0' \
    && curl "https://nodejs.org/dist/v${NODEV}/node-v${NODEV}-linux-x64.tar.gz" | tar -xzv > /dev/null \
    && cp ./node-v${NODEV}-linux-x64/bin/node /usr/bin/ \
    && ./node-v${NODEV}-linux-x64/bin/npm install -g npm 

RUN npm install --global aws-lambda-ric

# PMTiles: https://github.com/protomaps/go-pmtiles/releases
RUN curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.20.0/go-pmtiles_1.20.0_Linux_x86_64.tar.gz > /tmp/pmtiles.tar.gz && \
    tar -xzvf /tmp/pmtiles.tar.gz && \
    mv pmtiles /usr/bin/

# TippeCanoe: https://github.com/felt/tippecanoe/releases
RUN git clone -b 2.60.0 --depth 1 https://github.com/felt/tippecanoe.git /tmp/tippecanoe && \
    cd /tmp/tippecanoe && \
    make && \
    PREFIX=/usr/local make install && \
    rm -rf /tmp/tippecanoe

COPY ./ $HOME/task
WORKDIR $HOME/task

RUN npm install

#ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
#CMD ["app.handler"]

