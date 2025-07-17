<template>
    <div class="offline-container d-flex align-items-center justify-content-center h-100">
        <div class="text-center">
            <div class="offline-icon mb-3">
                <IconCloudOff size="48" />
            </div>
            <h2 class="mb-3">You're Offline</h2>
            <p class="text-muted mb-4">
                CloudTAK is currently offline. Some features may not be available.
            </p>
            <div class="mb-4">
                <p class="small text-muted">
                    <IconDatabase class="me-1" size="16" />
                    Cached data is available for viewing
                </p>
            </div>
            <div class="d-flex gap-2 justify-content-center">
                <button 
                    class="btn btn-primary" 
                    @click="checkConnection"
                    :disabled="checking"
                >
                    <IconRefresh 
                        :class="{ 'rotating': checking }" 
                        class="me-1" 
                        size="16" 
                    />
                    {{ checking ? 'Checking...' : 'Try Again' }}
                </button>
                <button 
                    class="btn btn-outline-secondary" 
                    @click="viewCached"
                >
                    <IconEye class="me-1" size="16" />
                    View Cached Data
                </button>
            </div>
            <div class="mt-4 small text-muted">
                <IconInfoCircle class="me-1" size="14" />
                Your work will sync when connection is restored
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { 
    IconCloudOff, 
    IconDatabase, 
    IconRefresh, 
    IconEye, 
    IconInfoCircle 
} from '@tabler/icons-vue';

const checking = ref(false);

const emit = defineEmits<{
    retry: [];
    viewCached: [];
}>();

async function checkConnection() {
    checking.value = true;
    
    try {
        // Try to fetch a lightweight endpoint to test connectivity
        const response = await fetch('/api/server', { 
            method: 'HEAD',
            cache: 'no-cache'
        });
        
        if (response.ok) {
            // Connection restored, emit retry event
            emit('retry');
        } else {
            throw new Error('Server not available');
        }
    } catch (error) {
        // Still offline, show message
        console.log('Still offline:', error);
    } finally {
        checking.value = false;
    }
}

function viewCached() {
    emit('viewCached');
}
</script>

<style scoped>
.offline-container {
    background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
    color: white;
    min-height: 100vh;
}

.offline-icon {
    opacity: 0.8;
}

.rotating {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.btn-primary {
    background-color: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
}

.btn-primary:hover {
    background-color: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
}

.btn-outline-secondary {
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.8);
}

.btn-outline-secondary:hover {
    background-color: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.4);
    color: white;
}
</style>