import Err from '@openaddresses/batch-error';
import TAKAPI from '../tak-api.js';
import { Type, Static } from '@sinclair/typebox';

export const LoginInput = Type.Object({
    username: Type.String(),
    password: Type.String()
})

export const TokenContents = Type.Object({
    sub: Type.String(),
    aud: Type.String(),
    nbf: Type.Number(),
    exp: Type.Number(),
    iat: Type.Number()
})

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    parse(jwt: string): Static<typeof TokenContents>{
        const split = Buffer.from(jwt, 'base64').toString().split('}').map((ext) => { return ext + '}'});
        if (split.length < 2) throw new Err(500, null, 'Unexpected TAK JWT Format');
        const contents: { sub: string; aud: string; nbf: number; exp: number; iat: number; } = JSON.parse(split[1]);

        return contents;
    }

    async login(query: Static<typeof LoginInput>): Promise<{
        token: string;
        contents: Static<typeof TokenContents>
    }> {
        const url = new URL(`/oauth/token`, this.api.url);

        url.searchParams.append('grant_type', 'password');
        url.searchParams.append('username', query.username);
        url.searchParams.append('password', query.password);

        const authres = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        const text = await authres.text();

        if (authres.status === 401) {
            throw new Err(400, new Error(text), 'TAK Server reports incorrect Username or Password');
        } else if (!authres.ok) {
            throw new Err(400, new Error(`Status: ${authres.status}: ${await authres.text()}`), 'Non-200 Response from Auth Server - Token');
        }

        const body: any = JSON.parse(text);

        if (body.error === 'invalid_grant' && body.error_description.startsWith('Bad credentials')) {
            throw new Err(400, null, 'Invalid Username or Password');
        } else if (body.error || !body.access_token) {
            throw new Err(500, new Error(body.error_description), 'Unknown Login Error');
        }

        return {
            token: body.access_token,
            contents: this.parse(body.access_token)
        };
    }
}
