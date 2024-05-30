use aws_lambda_events::event::sqs::SqsEventObj;
use lambda_runtime::{run, service_fn, tracing, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use geojson::{Feature};

#[derive(Debug, Deserialize, Serialize)]
struct DataBody {
    url: String,
    username: String,
    password: String,
    layer: String
}

#[derive(Debug, Deserialize, Serialize)]
struct DataSecrets {
    token: String,
    expires: u32,
    referer: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct DataOptions {
    logging: bool,
}

#[derive(Debug, Deserialize, Serialize)]
struct Data {
    id: i32,
    #[serde(rename="type")]
    event: String,
    feat: Feature,
    body: DataBody,
    secrets: DataSecrets,
    options: DataOptions
}

async fn function_handler(event: LambdaEvent<SqsEventObj<Data>>) -> Result<(), Error> {
    for record in event.payload.records.iter() {
        println!("{:?}", &record);
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing::init_default_subscriber();
    run(service_fn(function_handler)).await
}
