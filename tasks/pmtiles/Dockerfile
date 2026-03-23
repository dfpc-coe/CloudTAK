FROM public.ecr.aws/lambda/nodejs:24

COPY tasks/pmtiles/package*.json ${LAMBDA_TASK_ROOT}/

RUN npm install

COPY tasks/pmtiles/ ${LAMBDA_TASK_ROOT}/

RUN npm run build

CMD ["dist/index.handler"]
