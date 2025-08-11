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

declare module '@tak-ps/geojson-vt' {
    function geoJSONToTile(
        data: FeatureCollection,
        z: number,
        x: number,
        y: number,
        options?: {
            maxZoom?: number;
            tolerance?: number;
            extent?: number;
            buffer?: number;
            lineMetrics?: boolean;
        },
        shouldWrap?: boolean,
        shouldClip?: boolean
    ): {
        features: Array<Feature>,
        numPoints: number,
        numSimplified: number,
        numFeatures: number,
        source: null | Array<Feature>
        x: number,
        y: number,
        z: number,
        transformed: boolean,
        minX: number,
        minY: number,
        maxX: number,
        maxY: number,
    } | null
}
