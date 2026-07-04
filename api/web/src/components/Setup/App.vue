<template>
    <div class='page page-center cloudtak-gradient setup-page position-relative'>
        <div class='container container-normal py-4 position-relative setup-container'>
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div class='card card-md'>
                            <div class='card-body'>
                                <div class='text-center mb-4'>
                                    <img
                                        src='/CloudTAKLogo.svg'
                                        alt='CloudTAK logo'
                                        class='setup-logo'
                                        draggable='false'
                                    >
                                </div>
                                <h2 class='h2 text-center mb-4'>
                                    Connect to Server
                                </h2>

                                <div
                                    v-if='viewMode === "providers"'
                                    class='mt-2'
                                >
                                    <h3 class='h4 mb-3'>
                                        Known Providers
                                    </h3>

                                    <TablerAlert
                                        v-if='connectError'
                                        class='mb-3'
                                        title='Unable to Connect'
                                        :err='connectError'
                                        :compact='true'
                                    />

                                    <TablerLoading
                                        v-if='providersLoading'
                                        desc='Loading Providers'
                                    />

                                    <template v-else-if='providersError'>
                                        <TablerAlert
                                            class='mb-3'
                                            title='Unable to load providers'
                                            :err='providersError'
                                            :compact='true'
                                        />
                                        <button
                                            class='btn btn-outline-secondary w-100 mb-3'
                                            type='button'
                                            @click='loadProviders'
                                        >
                                            Retry
                                        </button>
                                    </template>

                                    <template v-else>
                                        <TablerInput
                                            v-model='searchTerm'
                                            icon='search'
                                            label='Search by Name'
                                            placeholder='Search CloudTAK providers'
                                            class='mb-3'
                                        />

                                        <TablerNone
                                            v-if='filteredProviders.length === 0'
                                            label='No Providers'
                                            :compact='true'
                                            :create='false'
                                        />

                                        <div class='row g-3 mb-4'>
                                            <div
                                                v-for='provider in filteredProviders'
                                                :key='provider.url'
                                                class='col-12'
                                            >
                                                <button
                                                    type='button'
                                                    class='card provider-card h-100 w-100 text-start'
                                                    :disabled='connecting'
                                                    @click='connect(provider.url)'
                                                >
                                                    <span class='card-body d-flex align-items-center gap-3'>
                                                        <img
                                                            v-if='providerLogo(provider)'
                                                            :src='providerLogo(provider) || undefined'
                                                            alt='Provider logo'
                                                            class='provider-logo'
                                                            draggable='false'
                                                        >
                                                        <span class='flex-grow-1 provider-details'>
                                                            <span class='fw-bold d-block'>{{ provider.name }}</span>
                                                            <span class='text-muted small d-block text-break'>{{ provider.url }}</span>
                                                        </span>
                                                        <span
                                                            v-if='isConnectingTo(provider.url)'
                                                            class='spinner-border spinner-border-sm flex-shrink-0'
                                                            role='status'
                                                            aria-label='Connecting'
                                                        />
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </template>

                                    <div class='form-footer'>
                                        <button
                                            class='btn btn-outline-secondary w-100'
                                            type='button'
                                            :disabled='connecting'
                                            @click='showView("manual")'
                                        >
                                            Manual Entry
                                        </button>
                                    </div>
                                </div>

                                <div
                                    v-else
                                    class='mt-2'
                                >
                                    <h3 class='h4 mb-3 text-center'>
                                        Manual Entry
                                    </h3>
                                    <div class='mb-3'>
                                        <TablerInput
                                            v-model='serverUrl'
                                            label='Server URL'
                                            placeholder='https://cloudtak.example.com'
                                            :error='connectError ? connectError.message : undefined'
                                            :disabled='connecting'
                                            @keyup.enter='connect(serverUrl)'
                                        />
                                    </div>
                                    <div class='form-footer d-grid gap-2'>
                                        <button
                                            class='btn btn-primary w-100'
                                            type='button'
                                            :disabled='connecting'
                                            @click='connect(serverUrl)'
                                        >
                                            <span
                                                v-if='connecting'
                                                class='spinner-border spinner-border-sm me-2'
                                                role='status'
                                            />
                                            <span v-if='connecting'>Connecting...</span>
                                            <span v-else>Connect</span>
                                        </button>
                                        <button
                                            class='btn btn-link'
                                            type='button'
                                            :disabled='connecting'
                                            @click='showView("providers")'
                                        >
                                            Back to Providers
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class='corner-logo'>
            <img
                src='/CloudTAKLogo.svg'
                alt='CloudTAK logo'
                draggable='false'
            >
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { fetchWithTimeout, normalizeServerUrl, validateServer } from './connect.ts'
import { TablerAlert, TablerInput, TablerLoading, TablerNone } from '@tak-ps/vue-tabler'

type ProviderLogo = {
    filename?: string
    mediaType?: string
    base64?: string
}

type Provider = {
    name: string
    url: string
    logo?: ProviderLogo
}

const PROVIDER_REGISTRY_URL = 'https://api.cloudtak.io/'

const providers = ref<Provider[]>([])
const providersLoading = ref(true)
const providersError = ref<Error | null>(null)

const searchTerm = ref('')
const viewMode = ref<'providers' | 'manual'>('providers')

const serverUrl = ref('')

// In-flight connection attempt; doubles as the busy flag so a second click
// can't start a competing attempt.
const connectingUrl = ref<string | null>(null)
const connectError = ref<Error | null>(null)

const connecting = computed(() => connectingUrl.value !== null)

const filteredProviders = computed(() => {
    const term = searchTerm.value.trim().toLowerCase()
    if (!term) return providers.value

    return providers.value.filter((provider) => provider.name.toLowerCase().includes(term))
})

function isConnectingTo(url: string): boolean {
    return connectingUrl.value !== null && connectingUrl.value === normalizeServerUrl(url)
}

function providerLogo(provider: Provider): string | null {
    if (!provider.logo?.base64) return null

    const mime = provider.logo.mediaType || 'image/png'
    return `data:${mime};base64,${provider.logo.base64}`
}

function showView(view: 'providers' | 'manual'): void {
    connectError.value = null
    viewMode.value = view
}

async function loadProviders(): Promise<void> {
    providersLoading.value = true
    providersError.value = null

    try {
        const response = await fetchWithTimeout(PROVIDER_REGISTRY_URL)
        if (!response.ok) throw new Error(`Provider list request failed with status ${response.status}`)

        const data = await response.json()
        providers.value = Array.isArray(data?.servers) ? data.servers : []
    } catch (err) {
        providersError.value = err instanceof Error ? err : new Error('Failed to load providers')
    } finally {
        providersLoading.value = false
    }
}

// On success the page stays busy until the navigation away completes.
async function connect(rawUrl: string): Promise<void> {
    if (connecting.value) return

    const url = normalizeServerUrl(rawUrl)
    if (!url) {
        connectError.value = new Error('Please enter a valid server URL')
        return
    }

    serverUrl.value = url
    connectingUrl.value = url
    connectError.value = null

    try {
        await validateServer(url)

        if (Capacitor.isNativePlatform()) {
            // Preferences only — an IndexedDB write followed by an immediate
            // navigation wedges the database for the next page in WKWebView.
            await Preferences.set({ key: 'serverUrl', value: url })
            window.location.href = '/login'
        } else if (window.electronAPI?.saveUrl) {
            window.electronAPI.saveUrl(url)
        } else {
            window.location.href = url
        }
    } catch (err) {
        connectError.value = err instanceof Error ? err : new Error('Failed to connect to server')
        connectingUrl.value = null
    }
}

onMounted(async () => {
    if (!Capacitor.isNativePlatform()) {
        window.location.href = '/'
        return
    }

    // A previously chosen server skips straight to login; a read failure
    // falls through to the picker rather than stranding the user.
    try {
        const { value } = await Preferences.get({ key: 'serverUrl' })
        if (value?.trim()) {
            window.location.href = '/login'
            return
        }
    } catch (err) {
        console.warn('Failed to read stored server URL', err)
    }

    await loadProviders()
})
</script>

<style scoped>
.setup-page {
    overflow-x: hidden;
    overflow-y: auto;
    min-height: 100vh;
}

.setup-container {
    z-index: 1;
}

.setup-logo {
    width: 140px;
    height: auto;
}

.provider-card {
    cursor: pointer;
    padding: 0;
    color: inherit;
    border: 1px solid rgba(32, 107, 196, 0.08);
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.provider-card:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
    border-color: rgba(32, 107, 196, 0.4);
    background-color: rgba(32, 107, 196, 0.05);
}

.provider-card:disabled {
    cursor: wait;
    opacity: 0.7;
}

.provider-logo {
    width: 48px;
    height: 48px;
    object-fit: contain;
}

.provider-details {
    min-width: 0;
}

.corner-logo {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 2;
    opacity: 0.9;
    pointer-events: none;
}

.corner-logo img {
    width: 64px;
    height: auto;
}

@media (max-width: 768px) {
    .corner-logo {
        display: none;
    }
}
</style>
