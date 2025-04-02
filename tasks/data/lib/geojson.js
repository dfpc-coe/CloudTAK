import path from 'node:path';

export default class GeoJSON {
    static register() {
        return {
            inputs: ['.geojsonld']
        };
    }

    constructor(task) {
        this.task = task;
    }

    async convert() {
        console.error('ok - converted to GeoJSON');
        return path.resolve(this.task.temp, this.task.etl.task.asset);
    }
}
