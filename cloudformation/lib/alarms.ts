import cf from '@openaddresses/cloudfriend';
import {
    elbDashboard,
    rdsDashboard,
    CPU_MEMORY_ALARM_THRESHOLD,
    type ELBDashboardOpts,
    type RDSDashboardOpts
} from './dashboard.ts';

/** CloudFormation fragment returned by the alarm builders */
export interface CFFragment {
    Resources: Record<string, object>;
}

/** Options for constructing ELB/ECS alarms and dashboard */
export interface ELBOpts extends ELBDashboardOpts {
    /** CloudFormation resource name prefix applied to every generated resource */
    prefix?: string;
    /** Existing SNS topic ARN or CF Ref/Att to route alarm notifications to */
    topic?: string | object;
    /** When `true` an `AWS::CloudWatch::Dashboard` resource is included */
    dashboard?: boolean;
}

/** Options for constructing RDS alarms and dashboard */
export interface RDSOpts extends RDSDashboardOpts {
    /** CloudFormation resource name prefix applied to every generated resource */
    prefix?: string;
    /** Existing SNS topic ARN or CF Ref/Att to route alarm notifications to */
    topic?: string | object;
    /** When `true` an `AWS::CloudWatch::Dashboard` resource is included */
    dashboard?: boolean;
}

/**
 * Generates CloudFormation resources providing metrics, alarms, and a dashboard
 * for an ECS-backed Application Load Balancer.
 */
export function ELB(opts: ELBOpts = {}): CFFragment {
    const prefix = opts.prefix ?? '';
    const dashboard = opts.dashboard ?? true;

    const Resources: Record<string, object> = {};

    if (opts.cluster && opts.service) {
        Resources[`${prefix}MemoryAlarm`] = {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'MemoryUtilization', cf.region, `${prefix.toLowerCase()}`]),
                Namespace: 'AWS/ECS',
                MetricName: 'MemoryUtilization',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: CPU_MEMORY_ALARM_THRESHOLD,
                EvaluationPeriods: 10,
                Statistic: 'Average',
                Period: 60,
                AlarmActions: opts.topic ? [opts.topic] : [],
                InsufficientDataActions: opts.topic ? [opts.topic] : [],
                Dimensions: [{
                    Name: 'ClusterName',
                    Value: opts.cluster
                }, {
                    Name: 'ServiceName',
                    Value: opts.service
                }]
            }
        };
        Resources[`${prefix}CpuAlarm`] = {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'CPUUtilization', cf.region, `${prefix.toLowerCase()}`]),
                Namespace: 'AWS/ECS',
                MetricName: 'CPUUtilization',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: CPU_MEMORY_ALARM_THRESHOLD,
                EvaluationPeriods: 10,
                Statistic: 'Average',
                Period: 60,
                AlarmActions: opts.topic ? [opts.topic] : [],
                InsufficientDataActions: opts.topic ? [opts.topic] : [],
                Dimensions: [{
                    Name: 'ClusterName',
                    Value: opts.cluster
                }, {
                    Name: 'ServiceName',
                    Value: opts.service
                }]
            }
        };
    }

    Resources[`${prefix}AlarmHTTPCodeELB5XX`] = {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
            AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeELB5XX', cf.region, `${prefix.toLowerCase()}`]),
            MetricName: 'HTTPCode_ELB_5XX_Count',
            Namespace: 'AWS/ApplicationELB',
            Statistic: 'Sum',
            Period: 60,
            EvaluationPeriods: 2,
            Threshold: 1,
            AlarmActions: opts.topic ? [opts.topic] : [],
            InsufficientDataActions: opts.topic ? [opts.topic] : [],
            Dimensions: [{
                Name: 'LoadBalancer',
                Value: opts.loadbalancer
            }],
            TreatMissingData: 'notBreaching',
            ComparisonOperator: 'GreaterThanThreshold'
        }
    };

    Resources[`${prefix}AlarmHTTPCodeBackend5XX`] = {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
            AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeBackend5XX', cf.region, `${prefix.toLowerCase()}`]),
            MetricName: 'HTTPCode_Target_5XX_Count',
            Namespace: 'AWS/ApplicationELB',
            Statistic: 'Sum',
            Period: 60,
            EvaluationPeriods: 2,
            Threshold: 1,
            AlarmActions: opts.topic ? [opts.topic] : [],
            InsufficientDataActions: opts.topic ? [opts.topic] : [],
            Dimensions: [{
                Name: 'LoadBalancer',
                Value: opts.loadbalancer
            }],
            TreatMissingData: 'notBreaching',
            ComparisonOperator: 'GreaterThanThreshold'
        }
    };

    Resources[`${prefix}AlarmHTTPCodeBackend5XXDuration`] = {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
            AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeBackend5XXDuration', cf.region, `${prefix.toLowerCase()}`]),
            MetricName: 'HTTPCode_Target_5XX_Count',
            Namespace: 'AWS/ApplicationELB',
            Statistic: 'Sum',
            Period: 60 * 5,
            EvaluationPeriods: 20 / 5,
            Threshold: 5,
            AlarmActions: opts.topic ? [opts.topic] : [],
            InsufficientDataActions: opts.topic ? [opts.topic] : [],
            Dimensions: [{
                Name: 'LoadBalancer',
                Value: opts.loadbalancer
            }],
            TreatMissingData: 'notBreaching',
            ComparisonOperator: 'GreaterThanThreshold'
        }
    };

    Resources[`${prefix}AlarmP99Latency`] = {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
            AlarmName: cf.join('-', [cf.stackName, 'AlarmP99Latency', cf.region, `${prefix.toLowerCase()}`]),
            MetricName: 'TargetResponseTime',
            Namespace: 'AWS/ApplicationELB',
            ExtendedStatistic: 'p99',
            Period: '60',
            EvaluationPeriods: '5',
            Threshold: '10',
            AlarmActions: opts.topic ? [opts.topic] : [],
            InsufficientDataActions: opts.topic ? [opts.topic] : [],
            Dimensions: [{
                Name: 'LoadBalancer',
                Value: opts.loadbalancer
            }],
            ComparisonOperator: 'GreaterThanThreshold'
        }
    };

    if (dashboard) {
        Resources[`${prefix}Dashboard`] = {
            Type: 'AWS::CloudWatch::Dashboard',
            Properties: {
                DashboardName: cf.sub('${AWS::StackName}-${AWS::Region}-' + prefix.toLowerCase()),
                DashboardBody: cf.sub(JSON.stringify(elbDashboard(opts)), {
                    LoadBalancerFullName: opts.loadbalancer,
                    TargetGroupFullName: opts.targetgroup,
                    Apache: opts.apache,
                    ServiceName: opts.service,
                    Cluster: opts.cluster
                })
            }
        };
    }

    return { Resources };
}

/**
 * Generates CloudFormation resources providing metrics, alarms, and a dashboard
 * for an RDS instance or Aurora cluster.
 */
export function RDS(opts: RDSOpts = {}): CFFragment {
    const prefix = opts.prefix ?? '';
    const dashboard = opts.dashboard ?? true;

    const Resources: Record<string, object> = {};

    const dimension = {
        Name: opts.instance ? 'DBInstanceIdentifier' : 'DBClusterIdentifier',
        Value: opts.instance ? opts.instance : opts.cluster
    };

    Resources[`${prefix}DBCpuAlarm`] = {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
            AlarmName: cf.join('-', [cf.stackName, 'DBCPUUtilization', cf.region]),
            Namespace: 'AWS/RDS',
            MetricName: 'CPUUtilization',
            ComparisonOperator: 'GreaterThanThreshold',
            Threshold: CPU_MEMORY_ALARM_THRESHOLD,
            EvaluationPeriods: 10,
            Statistic: 'Average',
            Period: 60,
            AlarmActions: opts.topic ? [opts.topic] : [],
            InsufficientDataActions: opts.topic ? [opts.topic] : [],
            Dimensions: [dimension]
        }
    };

    Resources[`${prefix}DBFreeStorage`] = {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
            AlarmName: cf.join('-', [cf.stackName, 'DBFreeStorage', cf.region]),
            Namespace: 'AWS/RDS',
            MetricName: 'FreeStorageSpace',
            ComparisonOperator: 'LessThanThreshold',
            Threshold: 10737418240, // 10 GB
            EvaluationPeriods: 10,
            Statistic: 'Average',
            Period: 60,
            AlarmActions: opts.topic ? [opts.topic] : [],
            InsufficientDataActions: opts.topic ? [opts.topic] : [],
            Dimensions: [dimension]
        }
    };

    if (dashboard) {
        Resources[`${prefix}DBDashboard`] = {
            Type: 'AWS::CloudWatch::Dashboard',
            Properties: {
                DashboardName: cf.sub('${AWS::StackName}-${AWS::Region}-db'),
                DashboardBody: cf.sub(JSON.stringify(rdsDashboard(opts)), {
                    Instance: opts.instance,
                    Cluster: opts.cluster
                })
            }
        };
    }

    return { Resources };
}

/**
 * High & Low urgency SNS topics that alarms publish notifications to.
 */
export default {
    Resources: {
        HighUrgencyAlarmTopic: {
            Type: 'AWS::SNS::Topic',
            Properties: {
                DisplayName: cf.join([cf.stackName, '-high-urgency']),
                TopicName: cf.join([cf.stackName, '-high-urgency'])
            }
        },
        LowUrgencyAlarmTopic: {
            Type: 'AWS::SNS::Topic',
            Properties: {
                DisplayName: cf.join([cf.stackName, '-low-urgency']),
                TopicName: cf.join([cf.stackName, '-low-urgency'])
            }
        }
    }
};
