FROM node:24-alpine3.23

ENV HOME=/home/retention
WORKDIR $HOME

COPY package*.json ./

RUN npm install

COPY ./ $HOME

RUN npm run lint \
    && npm run build

CMD ["npm", "run", "run-once"]
