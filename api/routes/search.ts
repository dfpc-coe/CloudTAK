import { Type, Static } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Weather, { FetchHourly } from '../lib/weather.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    const weather = new Weather();

    const ReverseResponse = Type.Object({
        weather: Type.Union([FetchHourly, Type.Null()])
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
                weather: null
            };

            try {
                response.weather = await weather.get(req.params.longitude, req.params.latitude);
            } catch (err) {
                console.error('Weather Fetch Error', err)
                response.weather = null;
            }
    
            return res.json(response);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
