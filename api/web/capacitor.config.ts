import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'io.cloudtak.app',
    appName: 'CloudTAK',
    webDir: 'dist',
    ios: {
        path: '../../ios'
    },
    android: {
        path: '../../android'
    }
};

export default config;
