export default class EsriProxy {
    token: string;

    constructor(token: string) {
        this.token = token;
    }

    static async generateToken(
        url: URL,
        username: string,
        password: string
    ): Promise<EsriProxy> {
        const body = new URLSearchParams();
        body.append('username', username);
        body.append('password', password);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: String(body)
        });

        const token: string = '123';

        return new EsriProxy(token);
    }
}
