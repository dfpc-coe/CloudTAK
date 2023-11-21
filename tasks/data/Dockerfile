FROM ghcr.io/osgeo/gdal:alpine-normal-3.8.0

ENV HOME=/home/etl
WORKDIR $HOME

RUN apk add sqlite sqlite-dev nodejs-current npm git make bash g++ zlib-dev

# Download and install Tippecanoe
RUN git clone -b 2.37.0 --depth 1 https://github.com/felt/tippecanoe.git /tmp/tippecanoe && \
    cd /tmp/tippecanoe && \
    make && \
    PREFIX=/usr/local make install && \
    rm -rf /tmp/tippecanoe

COPY ./ $HOME/task
WORKDIR $HOME/task

RUN npm install

CMD npm start
