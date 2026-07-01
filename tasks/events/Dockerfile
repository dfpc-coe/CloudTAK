FROM node:26-alpine3.24 AS build

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add git make bash g++ sqlite3pp zlib-dev

# TippeCanoe: https://github.com/felt/tippecanoe/releases
RUN export VERSION_TIPPECANOE='2.79.0' && \
    git clone -c "advice.detachedHead=false" -b "${VERSION_TIPPECANOE}" --depth 1 https://github.com/felt/tippecanoe.git /tmp/tippecanoe && \
    cd /tmp/tippecanoe && \
    make && \
    PREFIX=/usr/local make install && \
    rm -rf /tmp/tippecanoe

FROM ghcr.io/osgeo/gdal:alpine-normal-3.13.1 AS runtime

ENV APP_ROOT=/workspace
WORKDIR $APP_ROOT/tasks/events

COPY --from=build /usr/local/bin/tippecanoe* /usr/local/bin/
COPY --from=build /usr/local/bin/tile-join /usr/local/bin/

RUN apk add --no-cache nodejs npm curl libstdc++ sqlite-libs zlib

# PMTiles: https://github.com/protomaps/go-pmtiles/releases
RUN export VERSION_PMTILES='1.28.3' && \
    curl -L "https://github.com/protomaps/go-pmtiles/releases/download/v${VERSION_PMTILES}/go-pmtiles_${VERSION_PMTILES}_Linux_x86_64.tar.gz" > /tmp/pmtiles.tar.gz && \
    tar -xzvf /tmp/pmtiles.tar.gz && \
    mv pmtiles /usr/local/bin/

COPY tasks/events/package*.json ./

RUN npm install

COPY tasks/events/ ./
COPY api/derived-types.d.ts $APP_ROOT/api/derived-types.d.ts


CMD ["node", "index.ts"]
