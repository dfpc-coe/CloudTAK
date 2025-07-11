FROM alpine:3.22 AS build

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add git make bash g++ sqlite3pp zlib-dev

# TippeCanoe: https://github.com/felt/tippecanoe/releases
RUN export VERSION_TIPPECANOE='2.77.0' && \
    git clone -c "advice.detachedHead=false" -b "${VERSION_TIPPECANOE}" --depth 1 https://github.com/felt/tippecanoe.git /tmp/tippecanoe && \
    cd /tmp/tippecanoe && \
    make && \
    PREFIX=/usr/local make install && \
    rm -rf /tmp/tippecanoe

FROM alpine:3.22 AS runtime

ENV HOME=/home/events
WORKDIR $HOME

COPY --from=0 /usr/local/bin/tippecanoe* /usr/local/bin/
COPY --from=0 /usr/local/bin/tile-join /usr/local/bin/

RUN apk add nodejs npm gdal-tools curl

RUN export VERSION_PMTILES='1.27.1' && \
    curl -L "https://github.com/protomaps/go-pmtiles/releases/download/v${VERSION_PMTILES}/go-pmtiles_${VERSION_PMTILES}_Linux_x86_64.tar.gz" > /tmp/pmtiles.tar.gz && \
    tar -xzvf /tmp/pmtiles.tar.gz && \
    mv pmtiles /usr/local/bin/

COPY . $HOME

RUN npm install
RUN npm run build

CMD ["node", "dist/index.js"]
