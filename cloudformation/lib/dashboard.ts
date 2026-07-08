/**
 * Threshold (percent) at which the ECS CPU & Memory utilization alarms fire.
 *
 * Shared between the alarm definitions in `alarms.ts` and the dashboard
 * annotation lines below so the red threshold line always reflects the value
 * the alarms are actually configured with.
 */
export const CPU_MEMORY_ALARM_THRESHOLD = 80;

/** Colour used for CloudWatch alarm threshold annotation lines */
const ALARM_LINE_COLOR = '#d62728';

/** Options for building the ELB/ECS dashboard body */
export interface ELBDashboardOpts {
    prefix?: string;
    loadbalancer?: string | object;
    targetgroup?: string | object;
    cluster?: string | object;
    service?: string | object;
    apache?: string | object;
}

/** Options for building the RDS dashboard body */
export interface RDSDashboardOpts {
    prefix?: string;
    instance?: string | object;
    cluster?: string | object;
}

/**
 * Builds the CloudWatch dashboard widget definition for an ELB-backed ECS service.
 *
 * The returned object is intended to be serialised with `JSON.stringify` and
 * embedded in an `AWS::CloudWatch::Dashboard` resource via `cf.sub`.
 */
export function elbDashboard(opts: ELBDashboardOpts) {
    const widgets: object[] = [];

    if (opts.loadbalancer) {
        widgets.push({
            type: 'metric',
            x: 0,
            y: 0,
            width: 24,
            height: 6,
            properties: {
                title: 'HTTP status',
                view: 'timeSeries',
                stacked: false,
                metrics: [
                    ['AWS/ApplicationELB', 'HTTPCode_Target_2XX_Count', 'LoadBalancer', '${LoadBalancerFullName}', { label: '2xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                    ['.', 'HTTPCode_Target_4XX_Count', '.', '.', { label: 'target 4xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                    ['.', 'HTTPCode_ELB_4XX_Count', '.', '.', { label: 'elb 4xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                    ['.', 'HTTPCode_Target_5XX_Count', '.', '.', { label: 'target 5xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                    ['.', 'HTTPCode_ELB_5XX_Count', '.', '.', { label: 'elb 5xx', stat: 'Sum', period: 60, yAxis: 'left' }]
                ],
                region: '${AWS::Region}',
                period: 300,
                yAxis: {
                    left: { min: 0 },
                    right: { min: 0 }
                }
            }
        });
        widgets.push({
            type: 'metric',
            x: 0,
            y: 6,
            width: 24,
            height: 6,
            properties: {
                title: 'Latency',
                view: 'timeSeries',
                stacked: false,
                metrics: [
                    ['AWS/ApplicationELB', 'TargetResponseTime', 'LoadBalancer', '${LoadBalancerFullName}', { color: '#9467bd', label: 'avg', period: 60 }],
                    ['...', { color: '#c5b0d5', label: 'max', stat: 'Maximum', period: 60 }],
                    ['...', { color: '#c5b0d5', label: 'min', stat: 'Minimum', period: 60 }],
                    ['...', { stat: 'p99', period: 60, label: 'p99', color: '#9edae5' }]
                ],
                region: '${AWS::Region}',
                yAxis: {
                    left: { min: 0 },
                    right: { min: 0 }
                },
                period: 300,
                annotations: {
                    horizontal: [
                        { color: '#9edae5', label: 'p99 alarm', value: 10 }
                    ]
                }
            }
        });
    }

    if (opts.cluster && opts.service) {
        widgets.push({
            type: 'metric',
            x: 0,
            y: 12,
            width: 12,
            height: 6,
            properties: {
                title: 'Service capacity',
                view: 'timeSeries',
                stacked: false,
                metrics: [
                    ['Mapbox/ecs-cluster', 'DesiredCapacity', 'ServiceName', '${ServiceName}', 'ClusterName', '${Cluster}', { label: 'desired', stat: 'Minimum', period: 60 }],
                    ['.', 'RunningCapacity', '.', '.', '.', '.', { label: 'running', stat: 'Minimum', period: 60 }],
                    ['AWS/ApplicationELB', 'HealthyHostCount', 'TargetGroup', '${TargetGroupFullName}', 'LoadBalancer', '${LoadBalancerFullName}', { period: 60, stat: 'Minimum', label: 'healthy' }]
                ],
                region: '${AWS::Region}',
                period: 300,
                yAxis: { left: { min: 0 } }
            }
        });
        widgets.push({
            type: 'metric',
            x: 12,
            y: 12,
            width: 6,
            height: 6,
            properties: {
                title: 'CPU utilization',
                view: 'timeSeries',
                stacked: false,
                metrics: [
                    ['AWS/ECS', 'CPUUtilization', 'ServiceName', '${ServiceName}', 'ClusterName', '${Cluster}', { label: 'cpu', period: 60 }]
                ],
                region: '${AWS::Region}',
                period: 300,
                yAxis: { left: { min: 0, max: 110 } },
                annotations: {
                    horizontal: [
                        { color: ALARM_LINE_COLOR, label: 'alarm', value: CPU_MEMORY_ALARM_THRESHOLD }
                    ]
                }
            }
        });
        widgets.push({
            type: 'metric',
            x: 18,
            y: 12,
            width: 6,
            height: 6,
            properties: {
                title: 'Memory utilization',
                view: 'timeSeries',
                stacked: false,
                metrics: [
                    ['AWS/ECS', 'MemoryUtilization', 'ServiceName', '${ServiceName}', 'ClusterName', '${Cluster}', { label: 'memory', period: 60 }]
                ],
                region: '${AWS::Region}',
                period: 300,
                yAxis: { left: { min: 0, max: 110 } },
                annotations: {
                    horizontal: [
                        { color: ALARM_LINE_COLOR, label: 'alarm', value: CPU_MEMORY_ALARM_THRESHOLD }
                    ]
                }
            }
        });
    }

    if (opts.apache) {
        widgets.push({
            type: 'log',
            x: 0,
            y: 18,
            width: 24,
            height: 6,
            properties: {
                title: '5XX Requests',
                query: `
                    SOURCE '$\{Apache\}'
                    | fields @timestamp, @message | sort @timestamp desc
                    | parse @message '* - - [*] "* * *" * * "*" "*" "*"' as client, dateTimeString, httpVerb, url, protocol, statusCode, bytes, referer, userAgent, origIp
                    | filter statusCode >= "500" and statusCode <= 599
                    | display @timestamp, statusCode, httpVerb, url, userAgent, @log, @logStream
                `,
                region: '${AWS::Region}',
                stacked: false,
                view: 'table'
            }
        });
        widgets.push({
            type: 'log',
            x: 0,
            y: 24,
            width: 24,
            height: 6,
            properties: {
                title: 'Recent Errors',
                query: `
                    SOURCE '$\{Apache\}'
                        | fields @timestamp, @message
                        | sort @timestamp desc
                        | filter @message like /.*Error:.*/
                        | display @timestamp, @message, @log, @logStream
                `,
                region: '${AWS::Region}',
                stacked: false,
                view: 'table'
            }
        });
    }

    return { widgets };
}

/**
 * Builds the CloudWatch dashboard widget definition for an RDS instance or cluster.
 *
 * The returned object is intended to be serialised with `JSON.stringify` and
 * embedded in an `AWS::CloudWatch::Dashboard` resource via `cf.sub`.
 */
export function rdsDashboard(opts: RDSDashboardOpts) {
    const metric = opts.instance
        ? ['AWS/RDS', 'FreeStorageSpace', 'DBInstanceIdentifier', '${Instance}']
        : ['AWS/RDS', 'FreeStorageSpace', 'DBClusterIdentifier', '${Cluster}'];

    return {
        widgets: [
            {
                height: 6,
                width: 12,
                y: 0,
                x: 0,
                type: 'metric',
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [metric],
                    region: '${AWS::Region}',
                    title: 'FreeStorageSpace',
                    period: 300,
                    yAxis: { left: { min: 0 } }
                }
            },
            {
                height: 6,
                width: 11,
                y: 0,
                x: 12,
                type: 'metric',
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [metric],
                    region: '${AWS::Region}',
                    period: 300,
                    yAxis: { left: { min: 0, max: 100 } }
                }
            },
            {
                height: 6,
                width: 11,
                y: 6,
                x: 12,
                type: 'metric',
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        metric,
                        ['.', 'ReadLatency', '.', '.']
                    ],
                    region: '${AWS::Region}'
                }
            },
            {
                height: 6,
                width: 12,
                y: 6,
                x: 0,
                type: 'metric',
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [metric],
                    region: '${AWS::Region}'
                }
            }
        ]
    };
}
