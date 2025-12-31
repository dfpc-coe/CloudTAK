import { Type, Static } from '@sinclair/typebox'
import SunCalc from 'suncalc'
import geomagnetism from 'geomagnetism';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Weather, { FetchHourly } from '../lib/weather.js';
import { SearchManager } from '../lib/search.js';
import { SearchManagerConfig, FetchReverse, FetchSuggest, FetchForward } from '../lib/search/types.js';
import { Feature } from '@tak-ps/node-cot';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    const weather = new Weather();

    const searchManager = await SearchManager.init(config);

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
        magnetic: Type.Object({
            declination: Type.Number(),
            inclination: Type.Number()
        }),
        weather: Type.Union([Type.Null(), FetchHourly]),
        reverse: Type.Union([Type.Null(), FetchReverse]),
        elevation: Type.Union([Type.Null(), Type.String()])
    });

    const SuggestResponse = Type.Object({
        items: Type.Array(FetchSuggest)
    });

    const ForwardResponse = Type.Object({
        items: Type.Array(FetchForward)
    });

    const RouteResponse = Feature.FeatureCollection;

    await schema.get('/search', {
        name: 'Search Config',
        group: 'Search',
        description: 'Get information about the configured search provider(s)',
        res: SearchManagerConfig
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const searchConfig = await searchManager.config();

            return res.json(searchConfig);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/search/reverse/:longitude/:latitude', {
        name: 'Reverse Geocode',
        group: 'Search',
        description: 'Get information about a given point',
        params: Type.Object({
            latitude: Type.Number(),
            longitude: Type.Number()
        }),
        query: Type.Object({
            provider: Type.Optional(Type.String()),
            altitude: Type.Number({
                default: 0
            }),
            elevation: Type.Optional(Type.Number())
        }),
        res: ReverseResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const elevationUnit = await config.models.Profile.from(user.email).then(p => p.display_elevation).catch(() => 'feet');

            const sun = SunCalc.getTimes(new Date(), req.params.latitude, req.params.longitude, req.query.altitude);
            const magnetic = geomagnetism.model().point([req.params.latitude, req.params.longitude]);

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
                magnetic: {
                    declination: magnetic.decl,
                    inclination: magnetic.incl
                },
                weather: null,
                reverse: null,
                elevation: null,
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
                    if (searchManager.defaultProvider) {
                        try {
                            response.reverse = await searchManager.reverse(
                                req.query.provider || searchManager.defaultProvider,
                                req.params.longitude,
                                req.params.latitude
                            );
                        } catch (err) {
                            console.error('ESRI Fetch Error', err)
                        }
                    }
                })(),

            ])

            // Handle elevation from query parameter (from MapLibre terrain)
            const finalResponse = {
                sun: response.sun,
                magnetic: response.magnetic,
                weather: response.weather,
                reverse: response.reverse,
                elevation: req.query.elevation !== undefined
                    ? (elevationUnit === 'feet' || elevationUnit === 'FEET'
                        ? ((req.query.elevation / 1.5) * 3.28084).toFixed(2) + ' ft'
                        : (req.query.elevation / 1.5).toFixed(2) + ' m')
                    : null
            };

            res.json(finalResponse);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/search/route', {
        name: 'Route',
        group: 'Search',
        description: 'Generate a route given stop information',
        query: Type.Object({
            provider: Type.Optional(Type.String()),
            callsign: Type.String({
                description: 'Human readable name of the route',
                default: 'New Route'
            }),
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
            travelMode: Type.Optional(Type.String({
                description: 'Travel mode for routing',
                default: 'Driving Time'
            })),
        }),
        res: RouteResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const stops = [
                req.query.start.split(',').map(Number),
                req.query.end.split(',').map(Number)
            ] as [number, number][];

            if (searchManager.defaultProvider) {
                    const route = await searchManager.route(
                        req.query.provider || searchManager.defaultProvider,
                        stops,
                        req.query.travelMode
                    );

                    if (route.features.length === 1) {
                        route.features[0].properties.callsign = req.query.callsign;
                    } else {
                        for (let i = 0; i < route.features.length; i++) {
                            route.features[i].properties.callsign = `${req.query.callsign} #${i + 1}`;
                        }
                    }

                    res.json(route);
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
            provider: Type.Optional(Type.String()),
            query: Type.String(),
            limit: Type.Optional(Type.Integer()),
            magicKey: Type.String(),
            longitude: Type.Optional(Type.Number()),
            latitude: Type.Optional(Type.Number()),
        }),
        res: ForwardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const response: Static<typeof ForwardResponse> = {
                items: [],
            };

            if (searchManager.defaultProvider) {
                try {
                    response.items = await searchManager.forward(
                        req.query.provider || searchManager.defaultProvider,
                        req.query.query,
                        req.query.magicKey,
                        req.query.limit
                    );
                } catch (err) {
                    console.error('Forward Geocoding Error:', err);
                    response.items = [];
                }
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
            provider: Type.Optional(Type.String()),
            query: Type.String(),
            limit: Type.Integer({
                default: 10
            }),
            longitude: Type.Optional(Type.Number()),
            latitude: Type.Optional(Type.Number()),
        }),
        res: SuggestResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const response: Static<typeof SuggestResponse> = {
                items: [],
            };

            if (searchManager.defaultProvider) {
                try {
                    const location = (req.query.longitude !== undefined && req.query.latitude !== undefined)
                        ? [req.query.longitude, req.query.latitude] as [number, number]
                        : undefined;

                    response.items = await searchManager.suggest(
                        req.query.provider || searchManager.defaultProvider,
                        req.query.query,
                        req.query.limit,
                        location
                    );
                } catch (err) {
                    console.error('ESRI Suggest Error', err);
                }
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
