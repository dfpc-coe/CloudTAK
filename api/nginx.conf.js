let CSP = `add_header 'Content-Security-Policy' "default-src 'self' *.${process.env.API_URL}; $\{IMG}; $\{MEDIA}; $\{WORKER}; $\{CONNECT}; $\{STYLE_SRC_ATTR}; $\{STYLE_SRC_ELEM}; $\{FONT}; upgrade-insecure-requests;" always;`
if (process.env.API_URL.includes('localhost')) CSP = '';

// Check if API_URL is something.example.com vs example.com
const ROOT_URL = process.env.API_URL.match(/.*\.*\..*?\..*?$/)
    ? `*.${process.env.API_URL.replace(/^.*?\./, '')}:*`
    : ''

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
        add_header 'Strict-Transport-Security' 'max-age=31536000; includeSubDomains; preload' always;
        add_header 'Permissions-Policy' 'fullscreen=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self)' always;

        set $IMG "img-src 'self' data: *.${process.env.API_URL} ${ROOT_URL}";
        set $MEDIA "media-src 'self' blob: *.${process.env.API_URL}:* ${ROOT_URL}";
        set $FONT "font-src 'self' data:";
        set $WORKER "worker-src 'self' blob:";
        set $STYLE_SRC_ELEM "style-src-elem 'self' 'unsafe-inline'";
        set $STYLE_SRC_ATTR "style-src-attr 'unsafe-inline'";
        set $CONNECT "connect-src 'self' *.${process.env.API_URL}:* ${ROOT_URL}";
        ${CSP}

        location = / {
            add_header 'X-Content-Type-Options' 'nosniff' always;
            add_header 'X-Frame-Options' 'DENY' always;
            add_header 'Referrer-Policy' 'strict-origin-when-cross-origin' always;
            add_header 'Strict-Transport-Security' 'max-age=31536000; includeSubDomains; preload' always;
            add_header 'Permissions-Policy' 'fullscreen=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self)' always;
            ${CSP}

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
