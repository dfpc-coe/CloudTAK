import { Static } from '@sinclair/typebox';
import fs from 'node:fs';
import { Profile_Style } from './enums.js';
import { FullConfig } from './types.js';

export const FullConfigDefaults: Partial<Static<typeof FullConfig>> = {
    'geofence::enabled': false,
    'retention::enabled': true,
    'retention::connection-feature::enabled': true,
    'retention::chat::enabled': false,
    'retention::chat::days': 30,
    'retention::import::enabled': false,
    'retention::import::days': 30,
    'map::center': '-100,40',
    'map::zoom': 4,
    'map::pitch': 0,
    'map::bearing': 0,
    'display::style': Profile_Style.SYSTEM_DEFAULT,
    'proxy::enabled': false,
    'proxy::whitelist': [],
    'login::name': 'CloudTAK',
    'login::logo': `data:image/svg+xml;base64,${fs.readFileSync(new URL('../web/public/CloudTAKLogo.svg', import.meta.url)).toString('base64')}`,
    'login::signup': '',
    'login::forgot': '',
    'login::username': 'Username or Email',
    'login::brand::enabled': 'default',
    'login::background::enabled': false,
    'login::background::color': '#03384f',
    'login::brand::logo': `data:image/svg+xml;base64,${fs.readFileSync(new URL('../web/public/CloudTAKLogoText.svg', import.meta.url)).toString('base64')}`,
    'external::applications': [],
};
