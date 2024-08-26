FROM ghcr.io/osgeo/gdal:alpine-normal-3.9.2

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add sqlite sqlite-dev nodejs-current npm git make bash g++ zlib-dev curl

RUN curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.20.0/go-pmtiles_1.20.0_Linux_x86_64.tar.gz > /tmp/pmtiles.tar.gz && \
    tar -xzvf /tmp/pmtiles.tar.gz && \
    mv pmtiles /usr/bin/

# Download and install Tippecanoe
RUN git clone -b 2.60.0 --depth 1 https://github.com/felt/tippecanoe.git /tmp/tippecanoe && \
    cd /tmp/tippecanoe && \
    make && \
    PREFIX=/usr/local make install && \
    rm -rf /tmp/tippecanoe


COPY ./ $HOME/task
WORKDIR $HOME/task

RUN npm install

CMD ["npm", "start"]
