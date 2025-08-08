import { Type, Static } from '@sinclair/typebox'
import SunCalc from 'suncalc'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Weather, { FetchHourly } from '../lib/weather.js';
import Search, { FetchReverse, FetchSuggest, FetchForward } from '../lib/search.js';
import { Feature } from '@tak-ps/node-cot';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    const weather = new Weather();

    const search = new Search('');
    if (await config.models.Setting.typed('agol::enabled', false)) {
        search.token = (await config.models.Setting.typed('agol::token', '')).value;
    }

    const ReverseResponse = Type.Object({
        sun: Type.Object({
            sunrise: Type.String({ description: 'sunrise (top edge of the sun appears on the horizon)' }),
            sunriseEnd: Type.String({ description: 'sunrise ends (bottom edge of the sun touches the horizon)' }),
            goldenHourEnd: Type.String({ description: 'morning golden hour (soft light, best time for photography) ends' }),
            solarNoon: Type.String({ description: 'solar noon (sun is in the highest position)' }),
            goldenHour: Type.String({ description: 'evening golden hour starts' }),
            sunsetStart: Type.String({ description: 'sunset starts (bottom edge of the sun touches the horizon)' }),
            sunset: Type.String({ description: 'sunset (sun disappears below the horizon, evening civil twilight starts)' }),
            dusk: Type.String({ description: 'dusk (evening nautical twilight starts)' }),
            nauticalDusk: Type.String({ description: 'nautical dusk (evening astronomical twilight starts)' }),
            night: Type.String({ description: 'night starts (dark enough for astronomical observations)' }),
            nadir: Type.String({ description: 'nadir (darkest moment of the night, sun is in the lowest position)' }),
            nightEnd: Type.String({ description: 'night ends (morning astronomical twilight starts)' }),
            nauticalDawn: Type.String({ description: 'nautical dawn (morning nautical twilight starts)' }),
            dawn: Type.String({ description: 'dawn (morning nautical twilight ends, morning civil twilight starts)' }),
        }),
        weather: Type.Union([FetchHourly, Type.Null()]),
        reverse: Type.Union([FetchReverse, Type.Null()])
    });

    const SuggestResponse = Type.Object({
        items: Type.Array(FetchSuggest)
    });

    const ForwardResponse = Type.Object({
        items: Type.Array(FetchForward)
    });

    const RouteResponse = Feature.FeatureCollection;

    await schema.get('/search/reverse/:longitude/:latitude', {
        name: 'Reverse Geocode',
        group: 'Search',
        description: 'Get information about a given point',
        params: Type.Object({
            latitude: Type.Number(),
            longitude: Type.Number()
        }),
        query: Type.Object({
            altitude: Type.Number({
                default: 0
            })
        }),
        res: ReverseResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const sun = SunCalc.getTimes(new Date(), req.params.latitude, req.params.longitude, req.query.altitude);

            const response: Static<typeof ReverseResponse> = {
                sun: {
                    sunrise: sun.sunrise.toISOString(),
                    sunriseEnd: sun.sunriseEnd.toISOString(),
                    goldenHourEnd: sun.goldenHourEnd.toISOString(),
                    solarNoon: sun.solarNoon.toISOString(),
                    goldenHour: sun.goldenHour.toISOString(),
                    sunsetStart: sun.sunsetStart.toISOString(),
                    sunset: sun.sunset.toISOString(),
                    dusk: sun.dusk.toISOString(),
                    nauticalDusk: sun.nauticalDusk.toISOString(),
                    night: sun.night.toISOString(),
                    nadir: sun.nadir.toISOString(),
                    nightEnd: sun.nightEnd.toISOString(),
                    nauticalDawn: sun.nauticalDawn.toISOString(),
                    dawn: sun.dawn.toISOString(),
                },
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
                    if (search.token) {
                        try {
                            response.reverse = await search.reverse(req.params.longitude, req.params.latitude);
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

    await schema.get('/search/route', {
        name: 'Route',
        group: 'Search',
        description: 'Generate a route given stop information',
        query: Type.Object({
            start: Type.String({
                description: 'Lat,Lng of starting position'
            }),
            /* TODO Implement via ESRI API
            stops: Type.Optional(Type.Array(Type.String({
                description: 'Lat,Lng of required stops'
            }))),
            */
            end: Type.String({
                description: 'Lat,Lng of end position'
            }),
        }),
        res: RouteResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const stops = [
                req.query.start.split(',').map(Number),
                req.query.end.split(',').map(Number)
            ] as [number, number][];

            if (search.token) {
                res.json(await search.route(stops));
            } else {
                res.json({
                    type: 'FeatureCollection',
                    features: []
                });
            }
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

            if (search.token && req.query.query.trim().length) {
                response.items = await search.forward(req.query.query, req.query.magicKey, req.query.limit);
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
            limit: Type.Integer({
                default: 10
            }),
        }),
        res: SuggestResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const response: Static<typeof SuggestResponse> = {
                items: [],
            };

            if (search.token && req.query.query.trim().length) {
                response.items = await search.suggest(req.query.query, req.query.limit);
            }
            if (req.query.limit) {
                response.items = response.items.splice(0, req.query.limit);
            }

            res.json(response);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
