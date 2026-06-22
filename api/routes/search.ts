import { Type, Static } from '@sinclair/typebox';
import * as SunCalc from 'suncalc';
import geomagnetism from 'geomagnetism';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { FetchHourly } from '../lib/interface-weather.js';
import { SearchManager } from '../lib/interface-search.js';
import { SearchManagerConfig, FetchReverse, FetchSuggest, FetchForward } from '../lib/search/types.js';
import { Feature } from '@tak-ps/node-cot';
import Config from '../lib/config.js';

function optionalISOString(date: Date | null): string | null {
    if (date === null) return null;
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default async function router(schema: Schema, config: Config) {
    const searchManager = await SearchManager.init(config);
    const SunTime = (description: string) => Type.Union([Type.String(), Type.Null()], { description });

    const ReverseResponse = Type.Object({
        sun: Type.Object({
            sunrise: SunTime('sunrise (top edge of the sun appears on the horizon)'),
            sunriseEnd: SunTime('sunrise ends (bottom edge of the sun touches the horizon)'),
            goldenHourEnd: SunTime('morning golden hour (soft light, best time for photography) ends'),
            solarNoon: SunTime('solar noon (sun is in the highest position)'),
            goldenHour: SunTime('evening golden hour starts'),
            sunsetStart: SunTime('sunset starts (bottom edge of the sun touches the horizon)'),
            sunset: SunTime('sunset (sun disappears below the horizon, evening civil twilight starts)'),
            dusk: SunTime('dusk (evening nautical twilight starts)'),
            nauticalDusk: SunTime('nautical dusk (evening astronomical twilight starts)'),
            night: SunTime('night starts (dark enough for astronomical observations)'),
            nadir: SunTime('nadir (darkest moment of the night, sun is in the lowest position)'),
            nightEnd: SunTime('night ends (morning astronomical twilight starts)'),
            nauticalDawn: SunTime('nautical dawn (morning nautical twilight starts)'),
            dawn: SunTime('dawn (morning nautical twilight ends, morning civil twilight starts)'),
        }),
        magnetic: Type.Object({
            declination: Type.Number(),
            inclination: Type.Number(),
        }),
        weather: Type.Union([Type.Null(), FetchHourly]),
        reverse: Type.Union([Type.Null(), FetchReverse]),
        elevation: Type.Union([Type.Null(), Type.String()]),
    });

    const SuggestResponse = Type.Object({
        items: Type.Array(FetchSuggest),
    });

    const ForwardResponse = Type.Object({
        items: Type.Array(FetchForward),
    });

    const RouteResponse = Feature.FeatureCollection;

    await schema.get('/search', {
        name: 'Search Config',
        group: 'Search',
        description: 'Get information about the configured search provider(s)',
        res: SearchManagerConfig,
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
            longitude: Type.Number(),
        }),
        query: Type.Object({
            provider: Type.Optional(Type.String()),
            altitude: Type.Number({
                default: 0,
            }),
            elevation: Type.Optional(Type.Number()),
        }),
        res: ReverseResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const elevationUnit = await config.models.ProfileConfig.from(user.email).then(p => p['display::elevation'] as string).catch(() => 'feet');

            const sun = SunCalc.getTimes(new Date(), req.params.latitude, req.params.longitude, req.query.altitude);
            const magnetic = geomagnetism.model().point([req.params.latitude, req.params.longitude]);

            const response: Static<typeof ReverseResponse> = {
                sun: {
                    sunrise: optionalISOString(sun.sunrise),
                    sunriseEnd: optionalISOString(sun.sunriseEnd),
                    goldenHourEnd: optionalISOString(sun.goldenHourEnd),
                    solarNoon: optionalISOString(sun.solarNoon),
                    goldenHour: optionalISOString(sun.goldenHour),
                    sunsetStart: optionalISOString(sun.sunsetStart),
                    sunset: optionalISOString(sun.sunset),
                    dusk: optionalISOString(sun.dusk),
                    nauticalDusk: optionalISOString(sun.nauticalDusk),
                    night: optionalISOString(sun.night),
                    nadir: optionalISOString(sun.nadir),
                    nightEnd: optionalISOString(sun.nightEnd),
                    nauticalDawn: optionalISOString(sun.nauticalDawn),
                    dawn: optionalISOString(sun.dawn),
                },
                magnetic: {
                    declination: magnetic.decl,
                    inclination: magnetic.incl,
                },
                weather: null,
                reverse: null,
                elevation: null,
            };

            await Promise.all([
                (async () => {
                    try {
                        response.weather = await config.weather.get(req.params.longitude, req.params.latitude);
                    } catch (err) {
                        console.error('Weather Fetch Error', err);
                    }
                })(),
                (async () => {
                    if (searchManager.defaultProvider) {
                        try {
                            response.reverse = await searchManager.reverse(
                                req.query.provider || searchManager.defaultProvider,
                                req.params.longitude,
                                req.params.latitude,
                            );
                        } catch (err) {
                            console.error('ESRI Fetch Error', err);
                        }
                    }
                })(),

            ]);

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
                    : null,
            };

            res.json(finalResponse);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/search/reverse/:longitude/:latitude/sun', {
        name: 'Reverse Sun',
        group: 'Search',
        description: 'Get sun phase information for a given point',
        params: Type.Object({
            latitude: Type.Number(),
            longitude: Type.Number(),
        }),
        query: Type.Object({
            altitude: Type.Number({
                default: 0,
            }),
        }),
        res: Type.Object({
            sun: Type.Object({
                sunrise: SunTime('sunrise (top edge of the sun appears on the horizon)'),
                sunriseEnd: SunTime('sunrise ends (bottom edge of the sun touches the horizon)'),
                goldenHourEnd: SunTime('morning golden hour (soft light, best time for photography) ends'),
                solarNoon: SunTime('solar noon (sun is in the highest position)'),
                goldenHour: SunTime('evening golden hour starts'),
                sunsetStart: SunTime('sunset starts (bottom edge of the sun touches the horizon)'),
                sunset: SunTime('sunset (sun disappears below the horizon, evening civil twilight starts)'),
                dusk: SunTime('dusk (evening nautical twilight starts)'),
                nauticalDusk: SunTime('nautical dusk (evening astronomical twilight starts)'),
                night: SunTime('night starts (dark enough for astronomical observations)'),
                nadir: SunTime('nadir (darkest moment of the night, sun is in the lowest position)'),
                nightEnd: SunTime('night ends (morning astronomical twilight starts)'),
                nauticalDawn: SunTime('nautical dawn (morning nautical twilight starts)'),
                dawn: SunTime('dawn (morning nautical twilight ends, morning civil twilight starts)'),
            }),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const sun = SunCalc.getTimes(new Date(), req.params.latitude, req.params.longitude, req.query.altitude);

            res.json({
                sun: {
                    sunrise: optionalISOString(sun.sunrise),
                    sunriseEnd: optionalISOString(sun.sunriseEnd),
                    goldenHourEnd: optionalISOString(sun.goldenHourEnd),
                    solarNoon: optionalISOString(sun.solarNoon),
                    goldenHour: optionalISOString(sun.goldenHour),
                    sunsetStart: optionalISOString(sun.sunsetStart),
                    sunset: optionalISOString(sun.sunset),
                    dusk: optionalISOString(sun.dusk),
                    nauticalDusk: optionalISOString(sun.nauticalDusk),
                    night: optionalISOString(sun.night),
                    nadir: optionalISOString(sun.nadir),
                    nightEnd: optionalISOString(sun.nightEnd),
                    nauticalDawn: optionalISOString(sun.nauticalDawn),
                    dawn: optionalISOString(sun.dawn),
                },
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/search/reverse/:longitude/:latitude/magnetic', {
        name: 'Reverse Magnetic',
        group: 'Search',
        description: 'Get magnetic declination information for a given point',
        params: Type.Object({
            latitude: Type.Number(),
            longitude: Type.Number(),
        }),
        res: Type.Object({
            magnetic: Type.Object({
                declination: Type.Number(),
                inclination: Type.Number(),
            }),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const magnetic = geomagnetism.model().point([req.params.latitude, req.params.longitude]);

            res.json({
                magnetic: {
                    declination: magnetic.decl,
                    inclination: magnetic.incl,
                },
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/search/reverse/:longitude/:latitude/weather', {
        name: 'Reverse Weather',
        group: 'Search',
        description: 'Get weather forecast for a given point',
        params: Type.Object({
            latitude: Type.Number(),
            longitude: Type.Number(),
        }),
        res: Type.Object({
            weather: Type.Union([Type.Null(), FetchHourly]),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            let weather = null;
            try {
                weather = await config.weather.get(req.params.longitude, req.params.latitude);
            } catch (err) {
                console.error('Weather Fetch Error', err);
            }

            res.json({ weather });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/search/reverse/:longitude/:latitude/reverse', {
        name: 'Reverse Geocode Only',
        group: 'Search',
        description: 'Get reverse geocoding information for a given point',
        params: Type.Object({
            latitude: Type.Number(),
            longitude: Type.Number(),
        }),
        query: Type.Object({
            provider: Type.Optional(Type.String()),
        }),
        res: Type.Object({
            reverse: Type.Union([Type.Null(), FetchReverse]),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            let reverse = null;
            if (searchManager.defaultProvider) {
                try {
                    reverse = await searchManager.reverse(
                        req.query.provider || searchManager.defaultProvider,
                        req.params.longitude,
                        req.params.latitude,
                    );
                } catch (err) {
                    console.error('ESRI Fetch Error', err);
                }
            }

            res.json({ reverse });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/search/reverse/:longitude/:latitude/elevation', {
        name: 'Reverse Elevation',
        group: 'Search',
        description: 'Get elevation information for a given point',
        params: Type.Object({
            latitude: Type.Number(),
            longitude: Type.Number(),
        }),
        query: Type.Object({
            elevation: Type.Optional(Type.Number()),
        }),
        res: Type.Object({
            elevation: Type.Union([Type.Null(), Type.String()]),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const elevationUnit = await config.models.ProfileConfig.from(user.email).then(p => p['display::elevation'] as string).catch(() => 'feet');

            const elevation = req.query.elevation !== undefined
                ? (elevationUnit === 'feet' || elevationUnit === 'FEET'
                        ? ((req.query.elevation / 1.5) * 3.28084).toFixed(2) + ' ft'
                        : (req.query.elevation / 1.5).toFixed(2) + ' m')
                : null;

            res.json({ elevation });
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
                default: 'New Route',
            }),
            start: Type.String({
                description: 'Lat,Lng of starting position',
            }),
            /* TODO Implement via ESRI API
            stops: Type.Optional(Type.Array(Type.String({
                description: 'Lat,Lng of required stops'
            }))),
            */
            end: Type.String({
                description: 'Lat,Lng of end position',
            }),
            travelMode: Type.Optional(Type.String({
                description: 'Travel mode for routing',
                default: 'Driving Time',
            })),
        }),
        res: RouteResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const stops = [
                req.query.start.split(',').map(Number),
                req.query.end.split(',').map(Number),
            ] as [number, number][];

            if (searchManager.defaultProvider) {
                const route = await searchManager.route(
                    req.query.provider || searchManager.defaultProvider,
                    stops,
                    req.query.travelMode,
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
                    features: [],
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
        res: ForwardResponse,
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
                        req.query.limit,
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
                default: 10,
            }),
            longitude: Type.Optional(Type.Number()),
            latitude: Type.Optional(Type.Number()),
        }),
        res: SuggestResponse,
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
                        location,
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
