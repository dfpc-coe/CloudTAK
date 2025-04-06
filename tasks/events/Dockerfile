FROM alpine:3.21

ENV HOME=/home/events
WORKDIR $HOME

RUN apk add nodejs npm gdal-tools

COPY . $HOME

RUN npm install
RUN npm run build

CMD ["node", "dist/index.js"]
