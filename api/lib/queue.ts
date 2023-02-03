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
    q: object[];
    processing: boolean;

    constructor(stack: string) {
        super();
        this.db = new Dynamo(stack);
        this.q = [];
        this.processing = false;
    }

    queue(layer: number, items: Item[]) {
        for (const item of items) {
            item.layer = layer;
            this.q.push(item);
        }

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
