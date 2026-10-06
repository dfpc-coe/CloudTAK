import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import Lambda from '../stateless/lib/aws/lambda.js';
import {
    ECRClient,
    BatchGetImageCommand,
} from '@aws-sdk/client-ecr';
import {
    CreateStackCommand,
    DescribeStacksCommand,
    UpdateStackCommand,
    CloudFormationClient,
} from '@aws-sdk/client-cloudformation';
import {
    CloudWatchLogsClient,
    DeleteLogGroupCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
    GetFunctionCommand,
    LambdaClient,
} from '@aws-sdk/client-lambda';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.integration('etl-test');

flight.connection();

process.env.ECR_TASKS_REPOSITORY_NAME = 'example-ecr';

let layerId: number;
const templates: Array<any> = [];

function stub(): void {
    Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
        if (command instanceof DescribeStacksCommand) {
            if (command.input.StackName === 'test') {
                return Promise.resolve({ Stacks: [{ Tags: [] }] });
            } else {
                return Promise.resolve({ Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }] });
            }
        } else if (command instanceof CreateStackCommand || command instanceof UpdateStackCommand) {
            templates.push(JSON.parse(String(command.input.TemplateBody)));
            return Promise.resolve({});
        }

        throw new Error(`Unexpected CloudFormation command: ${command.constructor.name}`);
    });

    Sinon.stub(CloudWatchLogsClient.prototype, 'send').callsFake((command) => {
        if (command instanceof DeleteLogGroupCommand) {
            return Promise.resolve({});
        }

        throw new Error('Unexpected CloudWatch Logs command');
    });

    Sinon.stub(LambdaClient.prototype, 'send').callsFake((command) => {
        if (command instanceof GetFunctionCommand) {
            return Promise.resolve({ Code: {} });
        }

        throw new Error('Unexpected Lambda command');
    });

    Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
        if (command instanceof BatchGetImageCommand) {
            return Promise.resolve({
                images: [{
                    imageId: {
                        imageTag: 'etl-test-v1.0.0',
                        imageDigest: 'sha256:abcdef1234567890',
                    },
                    imageManifest: '{}',
                }],
            });
        }

        throw new Error('Unexpected ECR command');
    });
}

test('GET: api/config/layer - email domain', async () => {
    try {
        const res = await flight.fetch('/api/config/layer', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.email, {
            domain: 'mail.localhost',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer - invalid email sender', async () => {
    try {
        stub();

        const res = await flight.fetch('/api/connection/1/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Email Layer',
                description: 'This layer receives email',
                task: 'etl-test-v1.0.0',
                incoming: {
                    email: true,
                    email_senders: ['not-an-address'],
                },
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('POST: api/connection/1/layer - with incoming email', async () => {
    try {
        stub();
        templates.length = 0;

        const res = await flight.fetch('/api/connection/1/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Email Layer',
                description: 'This layer receives email',
                task: 'etl-test-v1.0.0',
                incoming: {
                    email: true,
                    email_senders: ['CAD@County.gov', '@agency.org', 'cad@county.gov'],
                },
            },
        }, true);

        layerId = res.body.id;

        assert.equal(templates.length, 1);
        assert.ok(templates[0].Resources.EmailParameter);

        assert.equal(res.body.incoming.cron, null);
        assert.equal(res.body.incoming.webhooks, false);
        assert.equal(res.body.incoming.email, true);
        assert.deepEqual(res.body.incoming.email_senders, ['cad@county.gov', '@agency.org']);

        const stack = Lambda.generate(flight.config!, res.body);

        assert.deepEqual(stack.Resources.EmailParameter, {
            Type: 'AWS::SSM::Parameter',
            Properties: {
                Type: 'String',
                Name: {
                    'Fn::Join': ['', [
                        { 'Fn::ImportValue': 'test-layer-prefix' },
                        { Ref: 'UniqueID' },
                    ]],
                },
                Description: `test-layer-${layerId}: Incoming Email`,
                Value: {
                    'Fn::Join': ['', [
                        '{"arn":"', { 'Fn::GetAtt': ['ETLFunction', 'Arn'] },
                        '","senders":', '["cad@county.gov","@agency.org"]',
                        '}',
                    ]],
                },
            },
        });

        assert.equal(Lambda.generate(flight.config!, { ...res.body, enabled: false }).Resources.EmailParameter, undefined);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('PATCH: api/connection/1/layer/:id/incoming - unrelated change does not deploy', async () => {
    try {
        stub();
        templates.length = 0;

        const res = await flight.fetch(`/api/connection/1/layer/${layerId}/incoming`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                stale: 60,
                email: true,
                email_senders: ['cad@county.gov', '@agency.org'],
            },
        }, true);

        assert.equal(res.body.email, true);
        assert.equal(templates.length, 0);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('PATCH: api/connection/1/layer/:id/incoming - update email senders', async () => {
    try {
        stub();
        templates.length = 0;

        const res = await flight.fetch(`/api/connection/1/layer/${layerId}/incoming`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                email_senders: ['Dispatch@County.gov'],
            },
        }, true);

        assert.equal(res.body.email, true);
        assert.deepEqual(res.body.email_senders, ['dispatch@county.gov']);

        assert.equal(templates.length, 1);
        assert.equal(templates[0].Resources.EmailParameter.Properties.Value['Fn::Join'][1][3], '["dispatch@county.gov"]');
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('PATCH: api/connection/1/layer/:id/incoming - disable email', async () => {
    try {
        stub();
        templates.length = 0;

        const res = await flight.fetch(`/api/connection/1/layer/${layerId}/incoming`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                email: false,
            },
        }, true);

        assert.equal(res.body.email, false);
        assert.deepEqual(res.body.email_senders, ['dispatch@county.gov']);

        assert.equal(templates.length, 1);
        assert.equal(templates[0].Resources.EmailParameter, undefined);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

flight.landing();
