import { Type, Static } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Weather, { FetchHourly } from '../lib/weather.js';
import Geocode, { FetchReverse, FetchSuggest, FetchForward } from '../lib/geocode.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    const weather = new Weather();

    const geocode = new Geocode('');
    if (await config.models.Setting.typed('agol::enabled', false)) {
        geocode.token = (await config.models.Setting.typed('agol::token', '')).value;
    }

    const ReverseResponse = Type.Object({
        weather: Type.Union([FetchHourly, Type.Null()]),
        reverse: Type.Union([FetchReverse, Type.Null()])
    });

    const SuggestResponse = Type.Object({
        items: Type.Array(FetchSuggest)
    });

    const ForwardResponse = Type.Object({
        items: Type.Array(FetchForward)
    });

    await schema.get('/search/reverse/:longitude/:latitude', {
        name: 'Reverse Geocode',
        group: 'Search',
        description: 'Get information about a given point',
        params: Type.Object({
            latitude: Type.Number(),
            longitude: Type.Number()
        }),
        res: ReverseResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);
            const response: Static<typeof ReverseResponse> = {
                weather: null,
                reverse: null,
            };

            await Promise.all([
                (async () => {
                    try {
                        response.weather = await weather.get(req.params.longitude, req.params.latitude);
                    } catch (err) {
                        console.error('Weather Fetch Error', err)
                    }
                })(),
                (async () => {
                    if (geocode.token) {
                        try {
                            response.reverse = await geocode.reverse(req.params.longitude, req.params.latitude);
                        } catch (err) {
                            console.error('ESRI Fetch Error', err)
                        }
                    }
                })()
            ])

            res.json(response);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/search/forward', {
        name: 'Forward',
        group: 'Search',
        description: 'Get information about a given string',
        query: Type.Object({
            query: Type.String(),
            limit: Type.Optional(Type.Integer()),
            magicKey: Type.String(),
        }),
        res: ForwardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const response: Static<typeof ForwardResponse> = {
                items: [],
            };

            if (geocode.token && req.query.query.trim().length) {
                response.items = await geocode.forward(req.query.query, req.query.magicKey, req.query.limit);
            }

            res.json(response);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/search/suggest', {
        name: 'Suggest',
        group: 'Search',
        description: 'Get information about a given string',
        query: Type.Object({
            query: Type.String(),
            limit: Type.Optional(Type.Integer()),
        }),
        res: SuggestResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const response: Static<typeof SuggestResponse> = {
                items: [],
            };

            if (geocode.token && req.query.query.trim().length) {
                response.items = await geocode.suggest(req.query.query, req.query.limit);
            }

            if (req.query.limit) {
                response.items.splice(0, req.query.limit);
            }

            res.json(response);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
