import fetch from './fetch.js';

export interface ArcGISConfig {
    authMethod: 'oauth2' | 'legacy';
    clientId?: string;
    clientSecret?: string;
    legacyToken?: string;
}

interface TokenData {
    token: string;
    expires: number;
}

export default class ArcGISTokenManager {
    private config: ArcGISConfig;
    private currentToken?: TokenData;

    constructor(config: ArcGISConfig) {
        this.config = config;
    }

    async getValidToken(): Promise<string> {
        if (this.config.authMethod === 'legacy') {
            return this.config.legacyToken || '';
        }

        if (this.config.authMethod === 'oauth2') {
            if (this.isTokenValid()) {
                return this.currentToken!.token;
            }
            return await this.refreshOAuthToken();
        }

        throw new Error('Invalid authentication method');
    }

    private isTokenValid(): boolean {
        if (!this.currentToken) return false;
        // Refresh at 90% of expiration time
        const refreshTime = this.currentToken.expires - (this.currentToken.expires * 0.1);
        return Date.now() < refreshTime;
    }

    private async refreshOAuthToken(): Promise<string> {
        if (!this.config.clientId || !this.config.clientSecret) {
            throw new Error('OAuth credentials not configured');
        }

        const formData = new URLSearchParams();
        formData.append('client_id', this.config.clientId);
        formData.append('client_secret', this.config.clientSecret);
        formData.append('grant_type', 'client_credentials');
        formData.append('f', 'json');

        const response = await fetch('https://www.arcgis.com/sharing/rest/oauth2/token', {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(`OAuth token refresh failed: ${data.error.message}`);
        }

        this.currentToken = {
            token: data.access_token,
            expires: Date.now() + (data.expires_in * 1000)
        };

        return this.currentToken.token;
    }

    async testConnection(): Promise<boolean> {
        try {
            const token = await this.getValidToken();
            if (!token) return false;

            const testUrl = this.config.authMethod === 'oauth2' 
                ? `https://www.arcgis.com/sharing/rest/portals/self?f=json&token=${token}`
                : `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer?f=json&token=${token}`;

            const response = await fetch(testUrl);
            const data = await response.json();
            
            return !data.error;
        } catch {
            return false;
        }
    }
}