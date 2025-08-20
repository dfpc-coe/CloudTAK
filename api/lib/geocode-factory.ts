import Geocode from './search.js';
import ArcGISTokenManager from './arcgis-token-manager.js';
import ArcGISConfigService from './arcgis-config.js';
import type Config from './config.js';

export async function createGeocodeService(appConfig: Config): Promise<Geocode> {
    const configService = ArcGISConfigService.getInstance(appConfig);
    
    if (!(await configService.isConfigured())) {
        // Return geocode service without authentication
        return new Geocode();
    }

    const config = await configService.getConfig();
    const tokenManager = new ArcGISTokenManager(config);
    
    return new Geocode(tokenManager);
}

export { Geocode, ArcGISTokenManager, ArcGISConfigService };