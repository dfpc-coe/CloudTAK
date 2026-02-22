<template>
    <div
        class='page page-center cloudtak-gradient position-relative'
        style='overflow: auto; min-height: 100vh; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);'
    >
        <div
            class='container container-normal py-4 position-relative'
            style='z-index: 1;'
        >
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div class='card card-md'>
                            <div class='card-body'>
                                <div
                                    class='text-center'
                                    style='margin-bottom: 24px;'
                                >
                                    <img
                                        :src='logo'
                                        alt='CloudTAK logo'
                                        class='logo'
                                    />
                                </div>
                                <h2 class='h2 text-center mb-4'>
                                    Connect to Server
                                </h2>
                                <div v-if='viewMode === "providers"' class='mt-2'>
                                    <div class='d-flex align-items-center justify-content-between mb-3'>
                                        <h3 class='h4 mb-0'>Known Providers</h3>
                                        <TablerLoading v-if='loading' desc='Loading providers' />
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
                                            <div
                                                class='card provider-card h-100'
                                                @click='pickProvider(provider.url)'
                                            >
                                                <div class='card-body d-flex align-items-center gap-3'>
                                                    <img
                                                        v-if='providerLogo(provider)'
                                                        :src='providerLogo(provider)'
                                                        alt='Provider logo'
                                                        class='provider-logo'
                                                    />
                                                    <div class='flex-grow-1'>
                                                        <div class='fw-bold'>{{ provider.name }}</div>
                                                        <div class='text-muted small'>{{ provider.url }}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class='form-footer'>
                                        <button
                                            class='btn btn-outline-secondary w-100'
                                            @click='viewMode = "manual"'
                                        >
                                            Manual Entry
                                        </button>
                                    </div>
                                </div>

                                <div v-else class='mt-2'>
                                    <h3 class='h4 mb-3 text-center'>Manual Entry</h3>
                                    <div class='mb-3'>
                                        <TablerInput
                                            v-model='serverUrl'
                                            icon='server'
                                            label='Server URL'
                                            placeholder='https://cloudtak.example.com'
                                            @keyup.enter='saveUrl'
                                        />
                                    </div>
                                    <div class='form-footer d-grid gap-2'>
                                        <button
                                            class='btn btn-primary w-100'
                                            @click='saveUrl'
                                        >
                                            Connect
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
                :src='logo'
                alt='CloudTAK logo'
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { TablerAlert, TablerInput, TablerLoading, TablerNone } from '@tak-ps/vue-tabler'
import logo from './assets/CloudTAKLogo.svg'

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
const searchTerm = ref('')
const loading = ref(false)
const error = ref<Error | null>(null)
const viewMode = ref<'providers' | 'manual'>('providers')

const filteredProviders = computed(() => {
    const term = searchTerm.value.trim().toLowerCase()
    if (!term) return providers.value
    return providers.value.filter((provider) => provider.name.toLowerCase().includes(term))
})

function providerLogo(provider: Provider) {
    if (!provider.logo?.base64) return null
    const mime = provider.logo.mediaType || 'image/png'
    return `data:${mime};base64,${provider.logo.base64}`
}

async function loadProviders() {
    loading.value = true
    error.value = null
    try {
        const response = await fetch('http://api.cloudtak.io/')
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const data = await response.json()
        providers.value = Array.isArray(data?.servers) ? data.servers : []
    } catch (err) {
        error.value = err instanceof Error ? err : new Error('Failed to load providers')
    } finally {
        loading.value = false
    }
}

function pickProvider(url: string) {
    serverUrl.value = url.startsWith('http') ? url : `https://${url}`
    saveUrl()
}

function saveUrl() {
    if (serverUrl.value) {
        // @ts-ignore
        if (window.electronAPI && window.electronAPI.saveUrl) {
            // @ts-ignore
            window.electronAPI.saveUrl(serverUrl.value)
        } else {
            // Fallback for older IPC or if contextIsolation is false
            const { ipcRenderer } = require('electron')
            ipcRenderer.send('save-url', serverUrl.value)
        }
    } else {
        alert('Please enter a valid URL')
    }
}

onMounted(() => {
    loadProviders()
})
</script>

<style>
body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.provider-card {
    cursor: pointer;
    border: 1px solid rgba(32, 107, 196, 0.08);
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.logo {
    width: 140px;
    height: auto;
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
