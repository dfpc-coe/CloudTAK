import Err from '@openaddresses/batch-error';
import CloudWatch, {
    MetricDataResult
} from '@aws-sdk/client-cloudwatch';
import moment from 'moment';
import process from 'node:process';

/**
 * @class
 */
export default class Metric {
    stack: string;
    cw: CloudWatch.CloudWatchClient;
    paused: boolean;

    constructor(stack: string) {
        this.stack = stack;
        this.cw = new CloudWatch.CloudWatchClient({ region: process.env.AWS_DEFAULT_REGION });
        this.paused = false;
    }

    async post(connid: number): Promise<void> {
        if (this.paused) return;

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
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to push metric data');
        }
    }

    async connection(connid: number): Promise<Array<MetricDataResult>> {
        if (this.paused) return [] as Array<MetricDataResult>;

        try {
            const res = await this.cw.send(new CloudWatch.GetMetricDataCommand({
                EndTime: moment().toDate(),
                StartTime: moment().subtract(12, 'hours').toDate(),
                MetricDataQueries: [{
                    Id: 'defaultSuccess',
                    MetricStat: {
                        Stat: 'Sum',
                        Period: 60 * 5, // 5 Minute Period
                        Metric: {
                            Namespace: 'TAKETL',
                            MetricName: 'ConnectionHealth',
                            Dimensions: [{
                                Name: 'StackName',
                                Value: this.stack
                            },{
                                Name: 'ConnectionId',
                                Value: String(connid)
                            }]
                        }
                    },
                    ReturnData: true
                }]
            }));

            if (!res || !res.MetricDataResults) return [] as Array<MetricDataResult>;
            return res.MetricDataResults;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), `Failed to retrieve metric data for Connection: ${connid}`);
        }
    }

    async sink(sinkid: number): Promise<Array<MetricDataResult>> {
        if (this.paused) return [] as Array<MetricDataResult>;

        try {
            const res = await this.cw.send(new CloudWatch.GetMetricDataCommand({
                EndTime: moment().toDate(),
                StartTime: moment().subtract(12, 'hours').toDate(),
                MetricDataQueries: [{
                    Id: 'defaultSuccess',
                    MetricStat: {
                        Stat: 'Sum',
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

            if (!res || !res.MetricDataResults) return [] as Array<MetricDataResult>;
            return res.MetricDataResults;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), `Failed to retrieve metric data for ConnectionSink: ${sinkid}`);
        }
    }
}
