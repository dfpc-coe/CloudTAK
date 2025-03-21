FROM ubuntu:24.04 as build

ENV HOME=/home/etl
WORKDIR $HOME

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends apt-utils tzdata \
    && apt-get install -y build-essential curl cmake autoconf libtool software-properties-common git libsqlite3-dev \
    && apt-get install -y python3 python3-pip python3-dev python3-setuptools

RUN export NODEV='22.14.0' \
    && curl "https://nodejs.org/dist/v${NODEV}/node-v${NODEV}-linux-x64.tar.gz" | tar -xzv > /dev/null \
    && cp ./node-v${NODEV}-linux-x64/bin/node /usr/bin/ \
    && ./node-v${NODEV}-linux-x64/bin/npm install -g npm

# PMTiles: https://github.com/protomaps/go-pmtiles/releases
RUN curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.20.0/go-pmtiles_1.20.0_Linux_x86_64.tar.gz > /tmp/pmtiles.tar.gz && \
    tar -xzvf /tmp/pmtiles.tar.gz && \
    mv pmtiles /usr/local/bin/

# TippeCanoe: https://github.com/felt/tippecanoe/releases
RUN git clone -b 2.60.0 --depth 1 https://github.com/felt/tippecanoe.git /tmp/tippecanoe && \
    cd /tmp/tippecanoe && \
    make && \
    PREFIX=/usr/local make install && \
    rm -rf /tmp/tippecanoe

FROM ubuntu:24.04 as runtime

COPY --from=0 /usr/local/bin/pmtiles* /usr/local/bin/
COPY --from=0 /usr/local/bin/tippecanoe* /usr/local/bin/
COPY --from=0 /usr/local/bin/tile-join /usr/local/bin/

RUN apt-get update \
    && apt-get install -y curl gdal-bin

COPY ./ $HOME/task
WORKDIR $HOME/task

RUN npm install

CMD ["npm", "start"]
