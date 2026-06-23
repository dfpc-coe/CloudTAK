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
                                    <div class='d-flex align-items-center justify-content-between mb-3'>
                                        <h3 class='h4 mb-0'>
                                            Known Providers
                                        </h3>
                                        <TablerLoading
                                            v-if='loading'
                                            desc='Loading providers'
                                        />
                                    </div>

                                    <TablerAlert
                                        v-if='error'
                                        class='mb-3'
                                        title='Unable to load providers'
                                        :err='error'
                                        :compact='true'
                                    />

                                    <TablerInput
                                        v-model='searchTerm'
                                        icon='search'
                                        label='Search by Name'
                                        placeholder='Search CloudTAK providers'
                                        class='mb-3'
                                    />

                                    <TablerNone
                                        v-if='!loading && !error && filteredProviders.length === 0'
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
                                                @click='pickProvider(provider.url)'
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
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    <div class='form-footer'>
                                        <button
                                            class='btn btn-outline-secondary w-100'
                                            type='button'
                                            @click='viewMode = "manual"'
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
                                            icon='server'
                                            label='Server URL'
                                            placeholder='https://cloudtak.example.com'
                                            :error='validationError'
                                            @keyup.enter='saveUrl'
                                        />
                                    </div>
                                    <div class='form-footer d-grid gap-2'>
                                        <button
                                            class='btn btn-primary w-100'
                                            type='button'
                                            :disabled='validating'
                                            @click='saveUrl'
                                        >
                                            <span v-if='validating'>Validating...</span>
                                            <span v-else>Connect</span>
                                        </button>
                                        <button
                                            class='btn btn-link'
                                            type='button'
                                            @click='viewMode = "providers"'
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
import { useAppStore } from '../../stores/app.ts'
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

const serverUrl = ref('')
const providers = ref<Provider[]>([])
const appStore = useAppStore()
const searchTerm = ref('')
const loading = ref(false)
const error = ref<Error | null>(null)
const viewMode = ref<'providers' | 'manual'>('providers')
const validating = ref(false)
const validationError = ref<string | null>(null)

const filteredProviders = computed(() => {
    const term = searchTerm.value.trim().toLowerCase()
    if (!term) return providers.value

    return providers.value.filter((provider) => provider.name.toLowerCase().includes(term))
})

function providerLogo(provider: Provider): string | null {
    if (!provider.logo?.base64) return null

    const mime = provider.logo.mediaType || 'image/png'
    return `data:${mime};base64,${provider.logo.base64}`
}

async function loadProviders(): Promise<void> {
    loading.value = true
    error.value = null

    try {
        const response = await fetch('https://api.cloudtak.io/')
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)

        const data = await response.json()
        providers.value = Array.isArray(data?.servers) ? data.servers : []
    } catch (err) {
        error.value = err instanceof Error ? err : new Error('Failed to load providers')
    } finally {
        loading.value = false
    }
}

function pickProvider(url: string): void {
    serverUrl.value = url.startsWith('http') ? url : `https://${url}`
    void saveUrl()
}

async function validateServer(url: string): Promise<void> {
    const base = url.replace(/\/$/, '')
    const response = await fetch(`${base}/api`)
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`)

    const data = await response.json()
    const version = data?.version
    if (!version) throw new Error('Server did not return a version')

    const match = String(version).match(/^v?(\d+)/)
    if (!match) throw new Error(`Unable to parse version: ${version}`)

    const major = parseInt(match[1], 10)
    if (major < 12) throw new Error(`Server version ${version} is not supported. Version v12 or higher is required.`)
}

async function saveUrl(): Promise<void> {
    const trimmedUrl = serverUrl.value.trim()

    if (!trimmedUrl) {
        validationError.value = 'Please enter a valid URL'
        return
    }

    serverUrl.value = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`
    validating.value = true
    validationError.value = null

    try {
        await validateServer(serverUrl.value)

        if (Capacitor.isNativePlatform()) {
            await appStore.setServerUrl(serverUrl.value)
            window.location.href = '/login'
        } else if (window.electronAPI?.saveUrl) {
            window.electronAPI.saveUrl(serverUrl.value)
        } else {
            window.location.href = serverUrl.value
        }
    } catch (err) {
        validationError.value = err instanceof Error ? err.message : 'Failed to validate server'
    } finally {
        validating.value = false
    }
}

onMounted(async () => {
    if (!Capacitor.isNativePlatform()) {
        window.location.href = '/'
        return
    }

    const { value } = await Preferences.get({ key: 'serverUrl' })
    if (value) {
        window.location.href = '/login'
        return
    }

    await loadProviders()
})
</script>

<style scoped>
.setup-page {
    overflow: auto;
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

.provider-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
    border-color: rgba(32, 107, 196, 0.4);
    background-color: rgba(32, 107, 196, 0.05);
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
