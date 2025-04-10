declare module '@openaddresses/cloudfriend' {
    const accountId: object;
    const notificationArns: object;
    const noValue: object;
    const region: object;
    const stackId: object;
    const stackName: object;
    const partition: object;
    const urlSuffix: object;

    function ref(ref: string): object
    function getAtt(obj: string, att: string): object
    function importValue(val: string): object

    function join(delimiter: string, join: Array<any>)
    function join(join: Array<any>)
}

