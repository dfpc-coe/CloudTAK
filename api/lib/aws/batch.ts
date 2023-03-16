import AWSBatch from '@aws-sdk/client-batch';
import Err from '@openaddresses/batch-error';
import Config from '../config.js';

/**
 * @class
 */
export default class Batch {
    static async submit(): Promise<void> {
        try {

        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to submit job');
        }
    }
};
