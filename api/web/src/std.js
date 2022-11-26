function std() {
    window.stdurl = function(url) {
        try {
            url = new URL(url);
        } catch (err) {
            url = new URL(url, window.location.origin);
        }

        // Allow serving through Vue for hotloading
        if (url.hostname === 'localhost') url.port = '4999'

        return url;
    }

    /**
     * Standardize interactions with the backend API
     *
     * @param {URL|String} url      - Full URL or API fragment to request
     * @param {Object} [opts={}]    - Options
     */
    window.std = async function(url, opts = {}) {
        url = window.stdurl(url)

        try {
            if (!opts.headers) opts.headers = {};

            if (typeof opts.body === 'object' && !opts.headers['Content-Type']) {
                opts.body = JSON.stringify(opts.body);
                opts.headers['Content-Type'] = 'application/json';
            }

            if (localStorage.token && !opts.headers.Authorization) {
                opts.headers['Authorization'] = 'Bearer ' + localStorage.token;
            }

            const res = await fetch(url, opts);

            let bdy = {};
            if ((res.status < 200 || res.status >= 400) && ![401].includes(res.status)) {
                try {
                    bdy = await res.json();
                } catch (err) {
                    throw new Error(`Status Code: ${res.status}`);
                }

                const err = new Error(bdy.message || `Status Code: ${res.status}`);
                err.body = bdy;
                throw err;
            }

            return await res.json();
        } catch (err) {
            throw new Error(err.message);
        }
    }
}

export default std;
