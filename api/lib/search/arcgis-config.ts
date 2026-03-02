import { ArcGISConfig } from './arcgis-token-manager.js';
import type Config from '../config.js';
import { GenerateUpsert } from '@openaddresses/batch-generic';

export default class ArcGISConfigService {
    private static instance?: ArcGISConfigService;
    private config?: ArcGISConfig;
    private appConfig: Config;

    private constructor(appConfig: Config) {
        this.appConfig = appConfig;
    }

    static getInstance(appConfig: Config): ArcGISConfigService {
        if (!ArcGISConfigService.instance) {
            ArcGISConfigService.instance = new ArcGISConfigService(appConfig);
        }
        return ArcGISConfigService.instance;
    }

    async getConfig(): Promise<ArcGISConfig> {
        // Always reload config to ensure we have the latest values
        this.config = await this.loadConfig();
        return this.config;
    }

    async refreshConfig(): Promise<void> {
        this.config = undefined;
    }

    async updateConfig(newConfig: ArcGISConfig): Promise<void> {
        this.config = newConfig;
        
        // Save to database
        if (newConfig.authMethod === 'oauth2') {
            await this.appConfig.models.Setting.generate({
                key: 'agol::auth_method',
                value: 'oauth2'
            }, { upsert: GenerateUpsert.UPDATE });
            
            if (newConfig.clientId) {
                await this.appConfig.models.Setting.generate({
                    key: 'agol::client_id',
                    value: newConfig.clientId
                }, { upsert: GenerateUpsert.UPDATE });
            }
            
            if (newConfig.clientSecret) {
                await this.appConfig.models.Setting.generate({
                    key: 'agol::client_secret',
                    value: newConfig.clientSecret
                }, { upsert: GenerateUpsert.UPDATE });
            }
        } else {
            await this.appConfig.models.Setting.generate({
                key: 'agol::auth_method',
                value: 'legacy'
            }, { upsert: GenerateUpsert.UPDATE });
            
            if (newConfig.legacyToken) {
                await this.appConfig.models.Setting.generate({
                    key: 'agol::token',
                    value: newConfig.legacyToken
                }, { upsert: GenerateUpsert.UPDATE });
            }
        }
    }

    private async loadConfig(): Promise<ArcGISConfig> {
        try {
            const settings = await this.appConfig.models.Setting.typedMany({
                'agol::auth_method': 'oauth2',
                'agol::client_id': '',
                'agol::client_secret': '',
                'agol::token': '',
            });

            if (settings['agol::auth_method'] === 'oauth2') {
                return {
                    authMethod: 'oauth2',
                    clientId: settings['agol::client_id'] || undefined,
                    clientSecret: settings['agol::client_secret'] || undefined
                };
            } else {
                return {
                    authMethod: 'legacy',
                    legacyToken: settings['agol::token'] || undefined
                };
            }
        } catch {
            // Default configuration
            return {
                authMethod: 'oauth2',
                clientId: undefined,
                clientSecret: undefined
            };
        }
    }

    async isConfigured(): Promise<boolean> {
        const config = await this.getConfig();
        if (config.authMethod === 'oauth2') {
            return !!(config.clientId && config.clientSecret);
        } else {
            return !!config.legacyToken;
        }
    }
}
