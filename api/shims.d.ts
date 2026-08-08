declare module 'milstandard-e' {
    export const ms2525e: Record<string, {
        symbolset: string;
        name: string;
        mainIcon: Array<{
            'Entity': string;
            'Entity Type'?: string;
            'Entity Subtype'?: string;
            'Code': string;
            'Remarks'?: string;
        }>;
        modifier1: Array<Record<string, string>>;
        modifier2: Array<Record<string, string>>;
    }>;
}

declare module 'tokml' {
    export default function(
        geojson: Static<typeof GeoJSONFeatureCollection>,
        opts: {
            documentName?: string;
            documentDescription?: string;
            simplestyle?: boolean
            name?: string
            description?: string
        }
    ): string;
}

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
