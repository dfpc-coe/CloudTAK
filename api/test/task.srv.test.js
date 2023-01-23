import test from 'tape';
import Flight from './flight.js';
import AWS from '@mapbox/mock-aws-sdk-js';

const flight = new Flight();

flight.init(test);
flight.takeoff(test);
flight.user(test);

test('GET: api/task', async (t) => {
    try {
        AWS.stub('ECR', 'listImages', async function(params) {
            t.deepEquals(params, {
                repositoryName: 'coe-ecr-etl-tasks'
            });
            return this.request.promise.returns(Promise.resolve({
                imageIds: []
            }));
        });


        const res = await flight.fetch('/api/task', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            tasks: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    AWS.ECR.restore();
    t.end();
});

flight.landing(test);
