declare module '@openaddresses/cloudfriend' {
    const partition: string;
    const accountId: string;
    const region: string;

    function ref(ref: string): object
    function getAtt(obj: string, att: string): object
    function importValue(val: string): object
    function join(join: Array<any>)
}

