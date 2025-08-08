import express from 'express';
import Schema from '@openaddresses/batch-schema';
import cors from 'cors';
import serverless from '@tak-ps/serverless-http';

if (!process.env.SigningSecret) throw new Error('SigningSecret env var must be provided');
if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env var must be provided');
if (!process.env.APIROOT) process.env.APIROOT = 'http://localhost:5002';

const app = express();
const config = {};

const schema = new Schema(express.Router(), {
    logging: true,
    limit: 50
});

app.disable('x-powered-by');

app.use(cors({
    origin: '*',
    allowedHeaders: [
        'ETAG',
        'Content-Type',
        'Content-Length',
        'Cache-Control',
        'Authorization',
        'User-Agent',
        'x-requested-with'
    ],
    credentials: true
}));

app.use(schema.router);
app.use('/api', schema.router);

await schema.load(
    new URL('./routes/', import.meta.url),
    config,
    {
        silent: false
    }
);

export const handler = serverless(app);

const startServer = async () => {
    app.listen(5002, () => {
        console.log('ok - tile server on http://localhost:5002');
    });
};

startServer();

