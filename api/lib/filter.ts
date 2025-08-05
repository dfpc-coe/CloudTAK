import { Type, Static } from '@sinclair/typebox'
import jsonata from 'jsonata';
import CoT, { CoTParser } from '@tak-ps/node-cot';
import Err from '@openaddresses/batch-error';

export const FilterContainerQuery = Type.Object({
    query: Type.String()
});

export const FilterContainer = Type.Object({
    queries: Type.Optional(Type.Array(FilterContainerQuery))
})

/**
 * Filter COT markers by a given set of filters
 * @class
 */
export default class Filter {
    /**
     * Return if a given feature matches a set of Queries
     *
     * @param filters       Filter Container
     * @param feature       GeoJSON Feature
     * @returns             GeoJSON Feature
     */
    static async test(
        filters: Static<typeof FilterContainer>,
        cot: CoT
    ): Promise<boolean> {
        if (!filters.queries) return false;

        const feature = await CoTParser.to_geojson(cot);

        try {
            for (const q of filters.queries) {
                try {
                    const expression = jsonata(q.query);

                    if (await expression.evaluate(feature) === true) {
                        return true;
                    }

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (err) {
                    // Ignore queries that result in invalid output - this is explicitly allowed
                }
            }

            return false;
        } catch (err) {
            if (err instanceof Error) {
                throw new Err(400, err, err.message);
            } else {
                throw new Err(400, new Error(String(err)), String(err));
            }
        }
    }

    static validate(filters: Static<typeof FilterContainer>) {
        try {
            if (filters.queries) {
                for (const q of filters.queries) {
                    jsonata(q.query);
                }
            }

            return true;
        } catch (err) {
            if (err instanceof Err) {
                throw err;
            } else if (err instanceof Error) {
                throw new Err(400, err, err.message);
            } else {
                throw new Err(400, new Error(String(err)), String(err));
            }
        }
    }
}
