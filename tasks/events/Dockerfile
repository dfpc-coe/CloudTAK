FROM alpine:3.21

ENV HOME=/home/events
WORKDIR $HOME

RUN apk add nodejs npm gdal-tools curl

RUN export VERSION_PMTILES='1.27.1' && \
    curl -L "https://github.com/protomaps/go-pmtiles/releases/download/v${VERSION_PMTILES}/go-pmtiles_${VERSION_PMTILES}_Linux_x86_64.tar.gz" > /tmp/pmtiles.tar.gz && \
    tar -xzvf /tmp/pmtiles.tar.gz && \
    mv pmtiles /usr/local/bin/

COPY . $HOME

RUN npm install
RUN npm run build

CMD ["node", "dist/index.js"]
