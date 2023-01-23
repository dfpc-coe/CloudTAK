# Lambda Tasks

The core of the ETL server is in it's source tasks that pull data from a wide varietry of
sources and convert data into GeoJSON or CoT XML for ingestion by the ETL server.

The ETL server manages the environment and lifetime of these servies and to do so has some
minor expectations in how it expects lambda docker functions to be set up.

## Dockerfile

The dockerfile can be set up in any format so long as it is capable of running on AWS Lamda.
It is good practice to use one of the AWS provided environments to simplify this process.

The following is an example of what a very lightweight NodeJS based lambda task would look like:

```
FROM public.ecr.aws/lambda/nodejs:18
COPY . ${LAMBDA_TASK_ROOT}/
RUN npm install
CMD ["task.handler"]
```

An example of a very light but fully functional NodeJS based task can be found at [tak-ps/etl-cotrip-plows](https://github.com/tak-ps/etl-cotrip-plows)

## Environment

- The lambda task is given a default of 128mb of memory in order to run.
  Care must be taken to perform the extract & transform in a streaming/paging fashion so not to
  exceed memory limitations of the lambda.
- Lambdas are run in an Internet Enabled environment and do not have access to private VPC resources.
- Custom Environment Variables can be included when the lambda is set up via the ETL API or UI

The following environment variables are provided by default to the lambda to facilitate
posting the transformed geospatial data to the ETL service

| Env Var Name  | Task |
| ------------- | ---- |
| `ETL_API`     | Base URL to the ETL API |
| `ETL_LAYER`   | Layer ID of the task    |
| `ETL_TOKEN`   | Layer specific authentication token |

The following is an example of posting resultant data back to the ETL service

```js
const post = await fetch(new URL(`/api/layer/${process.env.ETL_LAYER}/cot`, process.env.ETL_API), {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${process.env.ETL_TOKEN}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        type: 'FeatureCollection',
        features: []
    })
});

if (!post.ok) {
    console.error(await post.text());
    throw new Error('Failed to post layer to ETL');
} else {
    console.log(await post.json());
}

```

## Error Handling

When lambda tasks are set up via the ETL API, they automatically are created alongside cloudwatch metrics/alarms
to monitor invocation status. This status simplify ensures that invocations are successful and alarms if they
are not. As such, any fatal error should throw a non 0 exit code to ensure the logging infrastructure recognizes
that the lambda is failing. In NodeJS this is as simple as including an uncaught `throw new Error()`

