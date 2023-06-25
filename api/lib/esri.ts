import Err from '@openaddresses/batch-error';

export default class EsriProxy {
    token: string;
    base: URL;
    referer: string;

    constructor(token: string, base: URL, referer: string) {
        this.token = token;
        this.base = base;
        this.referer = referer;
    }

    static parser(url: URL): URL {
        const base = new URL(url.origin);
        const path = url.pathname.replace(/\/rest.*/, '') + '/rest';
        base.pathname = path;
        return base;
    }

    async getList() {
        const res = await fetch(this.base + `?f=json`, {
            method: 'GET',
            headers: {
                'Referer': this.referer,
                'X-Esri-Authorization': `Bearer ${this.token}`
            },
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async getServers() {
        const res = await fetch(this.base + `/portals/self/servers?f=json`, {
            method: 'GET',
            headers: {
                'Referer': this.referer,
                'X-Esri-Authorization': `Bearer ${this.token}`
            },
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    static async generateToken(
        url: URL,
        referer: string,
        username: string,
        password: string
    ): Promise<EsriProxy> {
        const body = new URLSearchParams();
        body.append('username', username);
        body.append('password', password);
        body.append('referer', referer);

        const base = this.parser(url);

        const res = await fetch(base + '/generateToken?f=json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: String(body)
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return new EsriProxy(
            json.token,
            this.parser(url),
            referer
        );
    }
}
