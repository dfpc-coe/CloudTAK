import { ref, computed } from 'vue';

// Global offline state management
export const isOnline = ref(navigator.onLine);
export const isOfflineMode = computed(() => !isOnline.value);
export const hasOfflineData = ref(false);

// Network status listeners
window.addEventListener('online', () => {
    isOnline.value = true;
    console.log('🌐 Back online');
});

window.addEventListener('offline', () => {
    isOnline.value = false;
    console.log('📴 Gone offline');
});

// Service Worker and Cache Management
export class OfflineService {
    private static instance: OfflineService;
    private sw: ServiceWorker | null = null;

    static getInstance(): OfflineService {
        if (!OfflineService.instance) {
            OfflineService.instance = new OfflineService();
        }
        return OfflineService.instance;
    }

    async init() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                this.sw = registration.active;
                
                // Listen for SW messages
                navigator.serviceWorker.addEventListener('message', this.handleSWMessage.bind(this));
                
                // Check if we have cached data
                await this.checkCachedData();
                
                console.log('📦 Offline service initialized');
            } catch (error) {
                console.error('Failed to initialize offline service:', error);
            }
        }
    }

    private async handleSWMessage(event: MessageEvent) {
        const { type, data } = event.data;
        
        switch (type) {
            case 'CACHE_UPDATED':
                console.log('🔄 Cache updated:', data);
                await this.checkCachedData();
                break;
            case 'OFFLINE_FALLBACK':
                console.log('📴 Serving offline fallback');
                break;
        }
    }

    async checkCachedData(): Promise<boolean> {
        if (!('caches' in window)) {
            hasOfflineData.value = false;
            return false;
        }

        try {
            const cacheNames = await caches.keys();
            const hasData = cacheNames.length > 0;
            
            // Check specific caches for important data
            const importantCaches = ['api-server-info', 'api-general', 'api-basemaps'];
            let hasImportantData = false;
            
            for (const cacheName of cacheNames) {
                if (importantCaches.some(name => cacheName.includes(name))) {
                    const cache = await caches.open(cacheName);
                    const keys = await cache.keys();
                    if (keys.length > 0) {
                        hasImportantData = true;
                        break;
                    }
                }
            }
            
            hasOfflineData.value = hasData && hasImportantData;
            return hasOfflineData.value;
        } catch (error) {
            console.error('Error checking cached data:', error);
            hasOfflineData.value = false;
            return false;
        }
    }

    async getCachedResponse(request: string | Request): Promise<Response | null> {
        if (!('caches' in window)) return null;

        try {
            const response = await caches.match(request);
            return response || null;
        } catch (error) {
            console.error('Error getting cached response:', error);
            return null;
        }
    }

    async clearOldCaches(): Promise<void> {
        if (!('caches' in window)) return;

        try {
            const cacheNames = await caches.keys();
            const oldCaches = cacheNames.filter(name => 
                name.includes('old-') || 
                name.includes('temp-')
            );

            await Promise.all(
                oldCaches.map(cacheName => caches.delete(cacheName))
            );

            console.log(`🗑️ Cleared ${oldCaches.length} old caches`);
        } catch (error) {
            console.error('Error clearing old caches:', error);
        }
    }

    async getCacheStats(): Promise<{
        totalCaches: number;
        totalEntries: number;
        estimatedSize: number;
    }> {
        if (!('caches' in window)) {
            return { totalCaches: 0, totalEntries: 0, estimatedSize: 0 };
        }

        try {
            const cacheNames = await caches.keys();
            let totalEntries = 0;
            let estimatedSize = 0;

            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();
                totalEntries += keys.length;

                // Estimate size (rough calculation)
                for (const request of keys.slice(0, 10)) { // Sample first 10 entries
                    try {
                        const response = await cache.match(request);
                        if (response) {
                            const blob = await response.blob();
                            estimatedSize += blob.size;
                        }
                    } catch (error) {
                        // Ignore individual errors
                    }
                }
            }

            // Extrapolate size estimate
            if (totalEntries > 10) {
                estimatedSize = Math.round((estimatedSize / Math.min(10, totalEntries)) * totalEntries);
            }

            return {
                totalCaches: cacheNames.length,
                totalEntries,
                estimatedSize
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return { totalCaches: 0, totalEntries: 0, estimatedSize: 0 };
        }
    }

    // Queue offline actions for when network returns
    private offlineQueue: Array<{
        id: string;
        method: string;
        url: string;
        data?: any;
        timestamp: number;
    }> = [];

    queueOfflineAction(method: string, url: string, data?: any): string {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        this.offlineQueue.push({
            id,
            method,
            url,
            data,
            timestamp: Date.now()
        });

        // Store in localStorage for persistence
        localStorage.setItem('offline-queue', JSON.stringify(this.offlineQueue));
        
        console.log(`📋 Queued offline action: ${method} ${url}`);
        return id;
    }

    async processOfflineQueue(): Promise<void> {
        if (!isOnline.value || this.offlineQueue.length === 0) return;

        console.log(`🚀 Processing ${this.offlineQueue.length} offline actions`);
        
        const results = await Promise.allSettled(
            this.offlineQueue.map(async (action) => {
                try {
                    const response = await fetch(action.url, {
                        method: action.method,
                        body: action.data ? JSON.stringify(action.data) : undefined,
                        headers: {
                            'Content-Type': 'application/json',
                            ...(localStorage.token && { 'Authorization': `Bearer ${localStorage.token}` })
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    console.log(`✅ Synced offline action: ${action.method} ${action.url}`);
                    return action.id;
                } catch (error) {
                    console.error(`❌ Failed to sync offline action: ${action.method} ${action.url}`, error);
                    throw error;
                }
            })
        );

        // Remove successfully processed actions
        const successfulIds = results
            .filter((result, index) => result.status === 'fulfilled')
            .map((result, index) => (result as PromiseFulfilledResult<string>).value);

        this.offlineQueue = this.offlineQueue.filter(
            action => !successfulIds.includes(action.id)
        );

        // Update localStorage
        localStorage.setItem('offline-queue', JSON.stringify(this.offlineQueue));

        console.log(`✅ Processed ${successfulIds.length} offline actions successfully`);
    }

    loadOfflineQueue(): void {
        try {
            const stored = localStorage.getItem('offline-queue');
            if (stored) {
                this.offlineQueue = JSON.parse(stored);
                console.log(`📋 Loaded ${this.offlineQueue.length} offline actions from storage`);
            }
        } catch (error) {
            console.error('Error loading offline queue:', error);
            this.offlineQueue = [];
        }
    }
}

// Initialize the offline service
export const offlineService = OfflineService.getInstance();