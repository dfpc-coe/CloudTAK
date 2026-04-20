<template>
    <MenuTemplate name='Package'>
        <template #buttons>
            <div class='d-flex align-items-center gap-2'>
                <TablerDelete
                    v-if='pkg && (profile && (profile.username === pkg.username || profile.system_admin))'
                    displaytype='icon'
                    @delete='deleteFile(pkg)'
                />
                <TablerIconButton
                    v-if='pkg && !loading && !error'
                    :title='"Download Asset"'
                    @click='downloadFile'
                >
                    <IconDownload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </template>
        <template #default>
            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading v-else-if='loading || !pkg || !profile' />
            <template v-else-if='mode === "share" && shareFeat'>
                <div class='container-fluid py-4'>
                    <div class='card border border-light-subtle cloudtak-bg text-white shadow-sm'>
                        <div class='card-header d-flex align-items-center gap-2'>
                            <IconShare2
                                :size='20'
                                stroke='1'
                            />
                            <span class='fw-semibold text-uppercase small'>Share Package</span>
                            <button
                                type='button'
                                class='btn-close btn-close-white ms-auto'
                                aria-label='Close share panel'
                                @click='mode = "default"'
                            />
                        </div>
                        <div class='card-body bg-black bg-opacity-25 rounded-bottom'>
                            <Share
                                :feats='[shareFeat]'
                                @done='mode = "default"'
                                @close='mode = "default"'
                            />
                        </div>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class='container-fluid py-4'>
                    <div class='row gy-3 gx-0 gx-lg-3'>
                        <div class='col-12'>
                            <div class='card h-100 cloudtak-bg text-white border border-light-subtle shadow-sm'>
                                <div class='card-body d-flex flex-column gap-4'>
                                    <div class='d-flex align-items-center gap-3'>
                                        <div class='rounded-circle bg-primary-subtle text-primary-emphasis p-1 d-flex align-items-center justify-content-center'>
                                            <IconPackage
                                                :size='32'
                                                stroke='1'
                                            />
                                        </div>
                                        <div class='flex-grow-1'>
                                            <p class='text-uppercase text-white-50 small mb-1'>
                                                Package
                                            </p>
                                            <h2
                                                class='h4 mb-0 text-break'
                                                v-text='pkg.name'
                                            />
                                        </div>
                                    </div>

                                    <div class='row gy-3 gx-0 gx-sm-3'>
                                        <div class='col-6'>
                                            <small class='text-uppercase text-white-50 d-block mb-1'>Created By</small>
                                            <p
                                                class='text-start text-white fw-semibold p-0 text-decoration-none'
                                                v-text='pkg.username'
                                            />
                                        </div>
                                        <div class='col-6'>
                                            <small class='text-uppercase text-white-50 d-block mb-2'>Created</small>
                                            <button
                                                type='button'
                                                class='menu-package__created-toggle'
                                                @click='relative = !relative'
                                            >
                                                <span class='menu-package__created-value'>
                                                    {{ relative ? timeDiff(pkg.created) : pkg.created }}
                                                </span>
                                                <span class='menu-package__created-hint'>
                                                    {{ relative ? 'Click to show the exact timestamp' : 'Click to return to relative time' }}
                                                </span>
                                            </button>
                                        </div>
                                        <div class='col-6'>
                                            <small class='text-uppercase text-white-50 d-block mb-1'>Expires</small>
                                            <p
                                                v-if='packageExpiration'
                                                class='fs-6 fw-semibold text-white mb-0 text-break'
                                                v-text='packageExpiration'
                                            />
                                            <p
                                                v-else
                                                class='fs-6 text-white-50 fst-italic mb-0'
                                            >
                                                None
                                            </p>
                                        </div>
                                        <div class='col-12'>
                                            <small class='text-uppercase text-white-50 d-block mb-2'>Hashtags</small>
                                            <Keywords
                                                :keywords='pkg.keywords'
                                                placeholder='No hashtags provided'
                                                tone='accent'
                                            />
                                        </div>
                                        <div class='col-12'>
                                            <small class='text-uppercase text-white-50 d-block mb-1'>Package Hash</small>
                                            <p
                                                class='fs-6 fw-semibold text-white mb-0 text-break'
                                                v-text='pkg.hash || "—"'
                                            />
                                        </div>
                                        <div class='col-12'>
                                            <small class='text-uppercase text-white-50 d-block mb-1'>Size</small>
                                            <p class='fs-6 text-white mb-0'>
                                                {{ packageSize }}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class='col-12'>
                            <div class='card h-100 cloudtak-bg text-white border border-light-subtle shadow-sm'>
                                <div class='card-body d-flex flex-column gap-3'>
                                    <p class='text-uppercase text-white-50 small mb-1'>
                                        Quick Actions
                                    </p>
                                    <button
                                        class='btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2'
                                        @click='createImport'
                                    >
                                        <IconFileImport
                                            :size='20'
                                            stroke='1'
                                        />
                                        <span>Import Package</span>
                                    </button>
                                    <button
                                        class='btn w-100 d-flex align-items-center justify-content-center gap-2 share-package-btn'
                                        :disabled='!shareFeat'
                                        @click='mode = "share"'
                                    >
                                        <IconShare2
                                            :size='20'
                                            stroke='1'
                                        />
                                        <span>Share Package</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { Server, Package as APIPackage, Feature } from '../../../../src/types.ts';
import { server, stdurl, std } from '../../../std.ts';
import Share from '../util/Share.vue';
import Keywords from '../util/Keywords.vue';
import timeDiff from '../../../timediff.ts';
import {
    TablerAlert,
    TablerDelete,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconShare2,
    IconDownload,
    IconFileImport,
    IconPackage
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';
import ProfileConfig from '../../../base/profile.ts';

type Package = APIPackage & {
    expiration?: number | string | null;
};

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const relative = ref(true);
const loading = ref(true);
const error = ref<Error | undefined>()
const mode = ref('default');
const serverConfig = ref<Server | undefined>();
const pkg = ref<Package | undefined>();

watch(route, async () => {
    await fetch();
});

const profile = ref<{
    username?: string;
    tak_callsign?: string;
    system_admin?: boolean;
}>({});

const shareFeat = computed<Feature | undefined>(() => {
    if (!profile.value || !pkg.value || !serverConfig.value) return;

    return {
        type: 'Feature',
        properties: {
            type: 'b-f-t-r',
            how: 'h-e',
            fileshare: {
                filename: pkg.value.name + '.zip',
                senderUrl: `${serverConfig.value.api}/Marti/sync/content?hash=${pkg.value.hash}`,
                sizeInBytes: pkg.value.size,
                sha256: pkg.value.hash,
                senderUid: `ANDROID-CloudTAK-${profile.value.username}`,
                senderCallsign: profile.value.tak_callsign,
                name: pkg.value.name
            },
            metadata: {},
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0, 0]
        }
    } as Feature;
});

const packageSize = computed(() => {
    if (!pkg.value?.size) return '—';

    const bytes = Number(pkg.value.size);
    if (!Number.isFinite(bytes) || bytes < 0) return `${pkg.value.size} B`;

    return formatBytes(bytes);
});

const packageExpiration = computed(() => {
    const expiration = pkg.value?.expiration;
    if (expiration === undefined || expiration === null) return null;

    if (typeof expiration === 'number') {
        return expiration === -1 ? null : formatDateValue(expiration);
    }

    if (expiration.trim() === '' || expiration.trim() === '-1') return null;

    const numericExpiration = Number(expiration);
    if (!Number.isNaN(numericExpiration)) {
        return numericExpiration === -1 ? null : formatDateValue(numericExpiration);
    }

    return formatDateValue(expiration);
});

function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function formatDateValue(value: number | string): string {
    if (typeof value === 'number') {
        const normalized = value > 0 && value < 1_000_000_000_000 ? value * 1000 : value;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}


onMounted(async () => {
    profile.value = {
        username: (await ProfileConfig.get('username'))?.value,
        tak_callsign: (await ProfileConfig.get('tak_callsign'))?.value,
        system_admin: (await ProfileConfig.get('system_admin'))?.value
    };

    serverConfig.value = await mapStore.worker.profile.loadServer();
    await fetch();
});

async function downloadFile(): Promise<void> {
    if (!pkg.value) return;

    const url = stdurl(`/api/marti/api/files/${pkg.value.hash}`)
    url.searchParams.set('token', localStorage.token);
    url.searchParams.set('name', pkg.value.name + '.zip');

    await std(url, {
        download: true
    });
}

async function fetch() {
    error.value = undefined;

    try {
        loading.value = true;

        const res = await server.GET('/api/marti/package/{:uid}', {
            params: {
                path: {
                    ':uid': String(route.params.package)
                },
            }
        });

        if (res.error) throw new Error(res.error.message);

        pkg.value = res.data;

        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }

    loading.value = false;
}

async function deleteFile(pkg: Package) {
    loading.value = true;

    try {
        await server.DELETE('/api/marti/package/{:uid}', {
            params: {
                path: {
                    ':uid': pkg.uid
                },
                query: {
                    hash: pkg.hash
                }
            }
        });

        router.push(`/menu/packages`)
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }

}

async function createImport() {
    if (!pkg.value) return;

    loading.value = true;

    try {
        const res = await server.POST('/api/import', {
            body: {
                name: pkg.value.name,
                source: 'Package',
                source_id: pkg.value.hash
            }
        });

        if (res.error) throw new Error(res.error.message);

        router.push(`/menu/imports/${res.data.id}`)
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>

<style scoped>
:global(html[data-bs-theme='dark']) .share-package-btn {
    --bs-btn-color: rgba(255, 255, 255, 0.92);
    --bs-btn-border-color: rgba(255, 255, 255, 0.35);
    --bs-btn-hover-color: #182433;
    --bs-btn-hover-bg: rgba(255, 255, 255, 0.92);
    --bs-btn-hover-border-color: rgba(255, 255, 255, 0.92);
}

:global(html[data-bs-theme='light']) .share-package-btn {
    --bs-btn-color: var(--tblr-body-color);
    --bs-btn-border-color: var(--tblr-border-color);
    --bs-btn-hover-color: var(--tblr-bg-surface);
    --bs-btn-hover-bg: var(--tblr-primary);
    --bs-btn-hover-border-color: var(--tblr-primary);
}

.menu-package__created-toggle {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    padding: 0.8rem 0.95rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 0.85rem;
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    text-align: left;
    transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.menu-package__created-toggle:hover {
    background: rgba(255, 255, 255, 0.11);
    border-color: rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.45);
}

.menu-package__created-toggle:focus-visible {
    outline: 2px solid rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.7);
    outline-offset: 2px;
    box-shadow: 0 0 0 0.2rem rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.2);
}

.menu-package__created-value {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.25;
    color: rgba(255, 255, 255, 0.96);
    word-break: break-word;
}

.menu-package__created-hint {
    font-size: 0.75rem;
    line-height: 1.3;
    color: rgba(255, 255, 255, 0.62);
}

:global(html[data-bs-theme='light']) .menu-package__created-toggle {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.24);
}

:global(html[data-bs-theme='light']) .menu-package__created-toggle:hover {
    background: rgba(255, 255, 255, 0.14);
}
</style>
