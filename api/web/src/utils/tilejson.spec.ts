import { describe, it, expect } from 'vitest';
import { authorizeTileJSON } from './tilejson.ts';

const HOSTS = ['api.example.com', 'tiles.example.com'];

describe('authorizeTileJSON', () => {
    it('appends the token to API and hosted tile URLs without encoding template braces', () => {
        const result = authorizeTileJSON({
            tiles: [
                'https://api.example.com/api/basemap/3/tiles/{z}/{x}/{y}',
                'https://tiles.example.com/tiles/public/roads/tiles/{$z}/{$x}/{$y}.mvt'
            ]
        }, 'abc/123', HOSTS);

        expect(result.tiles).toEqual([
            'https://api.example.com/api/basemap/3/tiles/{z}/{x}/{y}?token=abc%2F123',
            'https://tiles.example.com/tiles/public/roads/tiles/{$z}/{$x}/{$y}.mvt?token=abc%2F123'
        ]);
    });

    it('uses & when the URL already has a query string', () => {
        const result = authorizeTileJSON({
            tiles: ['https://api.example.com/api/basemap/3/tiles/{z}/{x}/{y}?format=png']
        }, 'tok', HOSTS);

        expect(result.tiles).toEqual(['https://api.example.com/api/basemap/3/tiles/{z}/{x}/{y}?format=png&token=tok']);
    });

    it('never sends the token to third-party hosts', () => {
        const result = authorizeTileJSON({
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png']
        }, 'tok', HOSTS);

        expect(result.tiles).toEqual(['https://tile.openstreetmap.org/{z}/{x}/{y}.png']);
    });

    it('leaves URLs that already carry a token untouched', () => {
        const signed = 'https://tiles.example.com/tiles/profile/me/asset/tiles/{z}/{x}/{y}.mvt?token=signed';
        const result = authorizeTileJSON({ tiles: [signed] }, 'tok', HOSTS);

        expect(result.tiles).toEqual([signed]);
    });

    it('is a no-op without a token and does not mutate the input', () => {
        const input = { tiles: ['https://api.example.com/api/basemap/3/tiles/{z}/{x}/{y}'], name: 'x' };
        const result = authorizeTileJSON(input, undefined, HOSTS);

        expect(result).toBe(input);

        authorizeTileJSON(input, 'tok', HOSTS);
        expect(input.tiles[0]).not.toContain('token');
    });
});
