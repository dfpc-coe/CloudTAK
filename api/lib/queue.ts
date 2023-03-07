// @ts-ignore
import Dynamo from './aws/dynamo.js';
import { EventEmitter } from 'node:events';

interface Item {
    id: string;
    layer: number;
    type: string;
    properties: object;
    geometry: object;
}

export default class DDBQueue extends EventEmitter {
    db: Dynamo;
    q: Item[];
    processing: boolean;

    constructor(stack: string) {
        super();
        this.db = new Dynamo(stack);
        this.q = [];
        this.processing = false;
    }

    queue(items: Item[]) {
        this.q.push(...items);
        if (!this.processing) this.process();
    }

    async process() {
        this.processing = true;

        try {
            const tiles = this.q.splice(0, 25);

            await this.db.puts(tiles);
        } catch (err) {
            this.emit('error');
        }

        this.processing = false;
    }
}
