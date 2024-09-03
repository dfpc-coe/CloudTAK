import Err from '@openaddresses/batch-error';
import TAKAPI from '../tak-api.js';
import { Type, Static } from '@sinclair/typebox';

export const LoginInput = Type.Object({
    username: Type.String(),
    password: Type.String()
})

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async login(query: Static<typeof LoginInput>): Promise<{ sub: string; aud: string; nbf: number; exp: number; iat: number; }> {
        console.error('LOGIN');
        const url = new URL(`/oauth/token`, this.api.url);
        console.error('HERE', url);

        url.searchParams.append('grant_type', 'password');
        url.searchParams.append('username', query.username);
        url.searchParams.append('password', query.password);

        const authres = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        if (!authres.ok) {
            throw new Err(500, new Error(`Status: ${authres.status}: ${await authres.text()}`), 'Non-200 Response from Auth Server - Token');
        }

        const body: any = await authres.json();

        if (body.error === 'invalid_grant' && body.error_description.startsWith('Bad credentials')) {
            throw new Err(400, null, 'Invalid Username or Password');
        } else if (body.error || !body.access_token) {
            throw new Err(500, new Error(body.error_description), 'Unknown Login Error');
        }

        const split = Buffer.from(body.access_token, 'base64').toString().split('}').map((ext) => { return ext + '}'});
        if (split.length < 2) throw new Err(500, null, 'Unexpected TAK JWT Format');
        const contents: { sub: string; aud: string; nbf: number; exp: number; iat: number; } = JSON.parse(split[1]);

        return contents;
    }
}
