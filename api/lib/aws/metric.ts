import Err from '@openaddresses/batch-error';
import CloudWatch from '@aws-sdk/client-cloudwatch';
import moment from 'moment';

/**
 * @class
 */
export default class Metric {
    stack: string;
    cw: CloudWatch.CloudWatchClient;

    constructor(stack: string) {
        this.stack = stack;
        this.cw = new CloudWatch.CloudWatchClient({ region: process.env.AWS_DEFAULT_REGION });

    }

    async post(connid: number) {
        try {
            await this.cw.send(new CloudWatch.PutMetricDataCommand({
                Namespace: 'TAKETL',
                MetricData: [{
                    MetricName: `ConnectionHealth`,
                    Unit: 'Count',
                    Value: 1,
                    Timestamp: new Date(),
                    Dimensions: [{
                        Name: 'ConnectionId',
                        Value: String(connid)
                    },{
                        Name: 'StackName',
                        Value: this.stack
                    }]
                }]
            }));
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to push metric data');
        }
    }

    async sink(sinkid: number) {
        try {
            return await this.cw.send(new CloudWatch.GetMetricDataCommand({
                EndTime: moment().toDate(),
                StartTime: moment().subtract(12, 'hours').toDate(),
                MetricDataQueries: [{
                    Id: 'defaultSuccess',
                    MetricStat: {
                        Stat: 'Average',
                        Period: 60 * 5, // 5 Minute Period
                        Metric: {
                            Namespace: 'TAKETL',
                            MetricName: 'ConnectionSinkSuccess',
                            Dimensions: [{
                                Name: 'StackName',
                                Value: this.stack
                            },{
                                Name: 'ConnectionSinkId',
                                Value: String(sinkid)
                            }]
                        }
                    },
                    ReturnData: true
                },{
                    Id: 'defaultFailure',
                    MetricStat: {
                        Stat: 'Sum',
                        Period: 60 * 5, // 5 Minute Period
                        Metric: {
                            Namespace: 'TAKETL',
                            MetricName: 'ConnectionSinkFailure',
                            Dimensions: [{
                                Name: 'StackName',
                                Value: this.stack
                            },{
                                Name: 'ConnectionSinkId',
                                Value: String(sinkid)
                            }]
                        }
                    },
                    ReturnData: true
                }]
            }));
        } catch (err) {
            throw new Err(500, new Error(err), `Failed to retrieve metric data for ConnectionSink: ${sinkid}`);
        }
    }
}
