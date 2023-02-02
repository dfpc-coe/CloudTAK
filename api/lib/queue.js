import Dynamo from './aws/dynamo.js';
import { EventEmitter } from 'node:events';

export default class DDBQueue extends EventEmitter {
    constructor(stack) {
        super();
        this.db = new Dynamo(stack);
        this.q = new Array();
        this.processing = false;
    }

    queue(layer, items) {
        for (const item of items) {
            item.layer = layer.id;
            this.q.push(item);
        }

        if (!this.processing) this.process();
    }

    async process() {
        this.processing = true;

        try {
            const tiles = this.q.splice(0, 25);

            this.db.puts(tiles);
        } catch (err) {
            this.$emit('error');
        }

        this.processing = false;
    }
}
