import net from 'node:net';

if (!process.env.API_URL) {
    throw new Error('API_URL environment variable is not set');
}

const url = new URL(process.env.API_URL);

let cspstr = '';
if (url.hostname === 'localhost') {
    // CSP is disabled when running on localhost
    cspstr = '';
} else {
    const isIP = net.isIP(url.hostname) || net.isIPv6(url.hostname)
    // FQDN: Check if API_URL is something.example.com vs example.com
    const isSub = process.env.API_URL.match(/.*\.*\..*?\..*?$/)

    const csp = {
        'default-src': [`'self'`],
        'img-src': [`'self'`, 'data:'],
        'media-src': [`'self'`, 'blob:'],
        'font-src': [`'self'`, 'data:'],
        'worker-src': [`'self'`, 'blob:'],
        'style-src-elem': [`'self'`, `'unsafe-inline'`],
        'style-src-attr': [`'unsafe-inline'`],
        'connect-src': [`'self'`]
    }

    cspstr = `add_header 'Content-Security-Policy' "`
    for (const [key, value] of Object.entries(csp)) {
        console.error(key, value);

        if (cspstr.endsWith(';')) cspstr += ' ';
        cspstr += `${key} ${value.join(' ')}`

        if (['img-src', 'media-src', 'connect-src', 'default-src'].includes(key)) {
            if (isIP) {
                cspstr += ` ${url.hostname}:*`;
            } else if (isSub) {
                cspstr += ` ${url.hostname}:* *.${url.hostname.replace(/^.*?\./, '')}:*`
            } else {
                cspstr += ` ${url.hostname}:*`
            }
        }

        cspstr += ';';
    }

    if (url.protocol === 'https:') {
        cspstr += `upgrade-insecure-requests;" always;`;
    } else {
        cspstr += `" always;`;
    }
}

let sts = '';
if (url.protocol === 'https:') {
    // Production use should always use HSTS but in dev/testing mode we disable it
    sts = `add_header 'Strict-Transport-Security' 'max-age=31536000; includeSubDomains; preload' always;`;
}

console.log(`
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
        '$status $body_bytes_sent "$http_referer" '
        '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    server {
        listen 5000;
        listen [::]:5000;

        client_max_body_size 512M;

        server_tokens off;

        add_header 'X-Content-Type-Options' 'nosniff' always;
        add_header 'X-Frame-Options' 'DENY' always;
        add_header 'Referrer-Policy' 'strict-origin-when-cross-origin' always;
        add_header 'Permissions-Policy' 'fullscreen=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self)' always;
        ${cspstr}
        ${sts}

        location = / {
            if ($request_uri ~ ^/(.*)\.html) {
                return 302 /$1;
            }

            add_header 'X-Content-Type-Options' 'nosniff' always;
            add_header 'X-Frame-Options' 'DENY' always;
            add_header 'Referrer-Policy' 'strict-origin-when-cross-origin' always;
            add_header 'Permissions-Policy' 'fullscreen=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self)' always;
            ${cspstr}
            ${sts}

            add_header 'Cache-Control' 'no-store, no-cache, must-revalidate' always;
            add_header 'Expires' 0 always;
            add_header 'Pragma' 'no-cache' always;

            alias /home/etl/api/web/dist/;
            try_files /index.html =404;
        }

        location / {
            if ($request_uri ~ ^/(.*)\.html) {
                return 302 /$1;
            }

             alias /home/etl/api/web/dist/;
             try_files $uri $uri.html $uri/ /index.html;
         }

        location /fonts/ {
            alias /home/etl/api/fonts/;
            autoindex on;
        }

        location /icons/ {
            alias /home/etl/api/icons/;
            autoindex on;
        }

        location ~ ^/api(?:/(.*))?$ {
            proxy_pass http://127.0.0.1:5001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

    }
}
`)
