import { Static } from '@sinclair/typebox';
import CloudFormation, { StackFrame } from './cloudformation.js';
import Config from '../../common/config.js';
import Lambda from './lambda.js';
import { setTimeout } from 'node:timers/promises';

export default class LayerDeploy {
    static async apply(
        config: Config,
        layerid: number,
        stack: Static<typeof StackFrame>,
    ): Promise<void> {
        if (!await CloudFormation.exists(config, layerid)) {
            await CloudFormation.create(config, layerid, stack);
            return;
        }

        if (await Lambda.requiresRecreate(config, layerid)) {
            await CloudFormation.delete(config, layerid);
            await this.waitForDelete(config, layerid);
            await CloudFormation.create(config, layerid, stack);
            return;
        }

        await CloudFormation.update(config, layerid, stack);
    }

    static async waitForDelete(config: Config, layerid: number): Promise<void> {
        const timeout = Date.now() + 5 * 60 * 1000;

        while (Date.now() < timeout) {
            const status = await CloudFormation.status(config, layerid);

            if (status.status === 'DOES_NOT_EXIST_COMPLETE') return;
            if (status.status.endsWith('_FAILED')) {
                throw new Error(`Failed to replace layer stack: ${status.status}`);
            }

            await setTimeout(3000);
        }

        throw new Error(`Timed out waiting for ${CloudFormation.stdname(config, layerid)} to delete`);
    }
}
