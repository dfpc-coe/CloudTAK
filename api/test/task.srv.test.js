import test from 'tape';
import Flight from './flight.js';
import AWS from '@mapbox/mock-aws-sdk-js';

const flight = new Flight();

flight.init(test);
flight.takeoff(test);
flight.user(test);

test('GET: api/task', async (t) => {
    try {
        AWS.stub('SecretsManager', 'createSecret', async function(params) {
            t.equals(params.Name, 'test-source-1');
            t.equals(params.Description, 'test Source: 1');
            t.deepEquals(JSON.parse(params.SecretString), {
                aws_access_key_id: '123',
                aws_secret_access_key: '123'
            });

            return this.request.promise.returns(Promise.resolve({}));
        });


        const res = await flight.fetch('/api/task', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            connections: [],
            status: {
                dead: 0,
                live: 0,
                unknown: 0
            }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    AWS.ECR.restore();
    t.end();
});

flight.landing(test);
