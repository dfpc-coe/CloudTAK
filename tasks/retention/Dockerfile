FROM node:24-alpine3.23

ENV APP_ROOT=/workspace
WORKDIR $APP_ROOT/tasks/retention

COPY tasks/retention/package*.json ./

RUN npm install

COPY tasks/retention/ ./

RUN npm run lint \
    && npm run build

CMD ["npm", "run", "run-once"]
