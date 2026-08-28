import { Static } from '@sinclair/typebox';
import { sql, eq, and } from 'drizzle-orm';
import { LayerStyle } from '../schema.js';
import { Layer_Style_Target } from '../enums.js';
import type { LayerStyles } from '../style.js';
import type Models from '../models.js';

export default class LayerStyleControl {
    /**
     * Upsert every target present in a LayerStyles object for the given Layer
     * Targets absent from the input are left untouched
     */
    static async commit(
        config: { models: Models },
        layer: number,
        styles: Static<typeof LayerStyles>,
    ): Promise<void> {
        for (const target of Object.values(Layer_Style_Target)) {
            const input = styles[target];
            if (!input) continue;

            const existing = await config.models.LayerStyle.list({
                where: and(
                    eq(LayerStyle.layer, layer),
                    eq(LayerStyle.target, target),
                ),
            });

            if (existing.items.length) {
                await config.models.LayerStyle.commit(existing.items[0].id, {
                    updated: sql`Now()`,
                    enabled: input.enabled,
                    style: input.style,
                });
            } else {
                await config.models.LayerStyle.generate({
                    layer,
                    target,
                    enabled: input.enabled,
                    style: input.style,
                });
            }
        }
    }
}
