import fetchCookie from 'fetch-cookie';
import { Readable } from 'stream';
import { pipeline } from 'node:stream/promises';
import path from 'path';
import fs from 'fs';

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function _err(res) {
    if (res.status !== 200) {
        throw new Error('FAIL');
    }

    return res;
}

export default async function(SERVER, USERNAME, PASSWORD) {
    const jar = new fetchCookie.toughCookie.CookieJar();
    fetch = fetchCookie(fetch, jar);

    if (!USERNAME) throw new Error('No LDAP_USERNAME env var set');
    if (!PASSWORD) throw new Error('No LDAP_PASSWPORD env var set');

    // Get PHP Session Tokens
    _err(await fetch(new URL('/lam/templates/login.php', SERVER), {
        method: 'GET'
    }));

    // Authenticate with service
    _err(await fetch(new URL('/lam/templates/login.php?expired=yes', SERVER), {
        credentials: 'include',
        'headers': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        'referrer': `${SERVER}/lam/templates/login.php`,
        body: `username=${encodeURIComponent(USERNAME)}&passwd=${encodeURIComponent(PASSWORD)}&language=en_US.utf8&checklogin=`,
        method: 'POST',
        'mode': 'cors'
    }));

    console.error('ok - authenticated');

    const exp = _err(await fetch(new URL('/lam/templates/tools/importexport.php', SERVER), {
        'credentials': 'include',
        'headers': {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:106.0) Gecko/20100101 Firefox/106.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1'
        },
        'referrer': `${SERVER}/lam/templates/tools/importexport.php?tab=export`,
        'method': 'GET',
        'mode': 'cors'
    }));

    const form = await exp.text();

    let sec_token = form.match(/<input.*?id="sec_token".*?>/)[0];

    sec_token = sec_token.match(/value="(.*?)"/)[1];

    console.error('SEC Token', sec_token);

    _err(await fetch(new URL('/lam/templates/tools/importexport.php?tab=export', SERVER), {
        'credentials': 'include',
        'headers': {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:106.0) Gecko/20100101 Firefox/106.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Content-Type': 'multipart/form-data; boundary=---------------------------209325389811113026843205198439',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        },
        'referrer': `${SERVER}/lam/templates/tools/importexport.php`,
        'body': `-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"baseDn\"\r\n\r\ndc=cotak,dc=gov\r\n-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"searchScope\"\r\n\r\nsub\r\n-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"filter\"\r\n\r\n(objectClass=*)\r\n-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"attributes\"\r\n\r\n*\r\n-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"saveAsFile\"\r\n\r\non\r\n-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"format\"\r\n\r\ncsv\r\n-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"ending\"\r\n\r\nunix\r\n-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"submitExport\"\r\n\r\n\r\n-----------------------------209325389811113026843205198439\r\nContent-Disposition: form-data; name=\"sec_token\"\r\n\r\n${sec_token}\r\n-----------------------------209325389811113026843205198439--\r\n`,
        'method': 'POST',
        'mode': 'cors'
    }));

    await sleep(5000);

    const res = _err(await fetch(new URL('/lam/templates/misc/ajax.php?function=export', SERVER), {
        'credentials': 'include',
        'headers': {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:106.0) Gecko/20100101 Firefox/106.0',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        },
        referrer: `${SERVER}/lam/templates/tools/importexport.php?tab=export`,
        body: `jsonInput=&sec_token=${sec_token}&baseDn=dc%3Dcotak%2Cdc%3Dgov&searchScope=sub&filter=(objectClass%3D*)&attributes=*&format=csv&ending=unix&includeSystem=false&saveAsFile=true`,
        method: 'POST',
        mode: 'cors'
    }));

    const final = await res.json();

    const download = await fetch(new URL(`/lam/tmp/${path.parse(final.file).base}`, SERVER), {
        method: 'GET'
    });

    await pipeline(
        Readable.fromWeb(download.body),
        fs.createWriteStream('/tmp/ldap.csv')
    );

    return new URL('/tmp/ldap.csv', 'file://');
}

