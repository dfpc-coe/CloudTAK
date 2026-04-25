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
                            <TablerBorder
                                class='cloudtak-bg text-white'
                                gap='lg'
                            >
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
                                        <span
                                            class='cursor-pointer text-sm text-white-50'
                                            @click='relative = !relative'
                                        >
                                            Created {{ relative ? timeDiff(pkg.created) : pkg.created }}
                                        </span>
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
                                    <div class='col-6' />
                                    <div class='col-12'>
                                        <TablerBorder
                                            background='rgba(0, 0, 0, 0.1)'
                                            :shadow='false'
                                            :fill-height='false'
                                            gap='sm'
                                        >
                                            <template #label>
                                                <small class='text-uppercase text-white-50 d-block mb-0'>Channels</small>
                                            </template>
                                            <template
                                                v-if='canEditPackage && !editingChannels'
                                                #tools
                                            >
                                                <TablerIconButton
                                                    title='Edit channels'
                                                    @click.stop.prevent='startEditingChannels'
                                                >
                                                    <IconPencil
                                                        :size='24'
                                                        stroke='1'
                                                    />
                                                </TablerIconButton>
                                            </template>

                                            <GroupSelectInline
                                                v-if='editingChannels'
                                                v-model='channelDraft'
                                                :saving='savingChannels'
                                                @cancel='cancelEditingChannels'
                                                @save='saveChannels'
                                            />

                                            <template v-else>
                                                <div
                                                    v-if='pkg.channels.length'
                                                    class='d-flex flex-wrap gap-2'
                                                >
                                                    <TablerBadge
                                                        v-for='channel of pkg.channels'
                                                        :key='channel'
                                                        class='rounded-pill text-uppercase fw-semibold'
                                                        background-color='rgba(107, 114, 128, 0.2)'
                                                        border-color='rgba(107, 114, 128, 0.5)'
                                                        text-color='#d1d5db'
                                                    >
                                                        {{ channel }}
                                                    </TablerBadge>
                                                </div>
                                                <p
                                                    v-else
                                                    class='text-start text-white fw-semibold p-0 mb-0 text-decoration-none'
                                                >
                                                    None
                                                </p>
                                            </template>
                                        </TablerBorder>
                                    </div>
                                    <div class='col-12'>
                                        <TablerBorder
                                            background='rgba(0, 0, 0, 0.1)'
                                            :shadow='false'
                                            :fill-height='false'
                                            gap='sm'
                                        >
                                            <template #label>
                                                <small class='text-uppercase text-white-50 d-block mb-0'>Expiry</small>
                                            </template>
                                            <template
                                                v-if='canEditPackage && !editingExpiration'
                                                #tools
                                            >
                                                <TablerIconButton
                                                    title='Edit expiry'
                                                    @click.stop.prevent='startEditingExpiration'
                                                >
                                                    <IconPencil
                                                        :size='24'
                                                        stroke='1'
                                                    />
                                                </TablerIconButton>
                                            </template>
                                            <template v-if='editingExpiration'>
                                                <TablerInput
                                                    label='Expiration Time'
                                                    type='datetime-local'
                                                    :model-value='expirationDraft'
                                                    @update:model-value='expirationDraft = String($event || "")'
                                                />

                                                <div class='d-flex justify-content-end gap-2 pt-2'>
                                                    <TablerButton
                                                        :disabled='savingExpiration'
                                                        @click.stop='cancelEditingExpiration'
                                                    >
                                                        Cancel
                                                    </TablerButton>
                                                    <TablerButton
                                                        :disabled='savingExpiration'
                                                        @click.stop='clearExpiration'
                                                    >
                                                        Clear
                                                    </TablerButton>
                                                    <TablerButton
                                                        class='btn-primary'
                                                        :disabled='savingExpiration'
                                                        @click.stop='saveExpiration'
                                                    >
                                                        {{ savingExpiration ? 'Saving...' : 'Save' }}
                                                    </TablerButton>
                                                </div>
                                            </template>

                                            <button
                                                v-if='packageExpiration'
                                                type='button'
                                                class='btn btn-link p-0 text-start text-reset fw-semibold menu-package__inline-button'
                                                @click.stop='expirationRelative = !expirationRelative'
                                                v-text='packageExpiration'
                                            />
                                            <p
                                                v-else
                                                class='text-start text-white fw-semibold p-0 mb-0 text-decoration-none'
                                            >
                                                None
                                            </p>
                                        </TablerBorder>
                                    </div>
                                    <div class='col-12'>
                                        <TablerBorder
                                            background='rgba(0, 0, 0, 0.1)'
                                            :shadow='false'
                                            :fill-height='false'
                                            gap='sm'
                                        >
                                            <template #label>
                                                <small class='text-uppercase text-white-50 d-block mb-0'>Hashtags</small>
                                            </template>
                                            <template
                                                v-if='canEditPackage && !editingKeywords'
                                                #tools
                                            >
                                                <TablerIconButton
                                                    title='Edit hashtags'
                                                    @click.stop.prevent='startEditingKeywords'
                                                >
                                                    <IconPencil
                                                        :size='24'
                                                        stroke='1'
                                                    />
                                                </TablerIconButton>
                                            </template>
                                            <template v-if='editingKeywords'>
                                                <TagEntry
                                                    :model-value='keywordDraft'
                                                    placeholder='Add hashtags'
                                                    @update:model-value='keywordDraft = $event'
                                                />

                                                <div class='d-flex justify-content-end gap-2 pt-2'>
                                                    <TablerButton
                                                        :disabled='savingKeywords'
                                                        @click.stop='cancelEditingKeywords'
                                                    >
                                                        Cancel
                                                    </TablerButton>
                                                    <TablerButton
                                                        class='btn-primary'
                                                        :disabled='savingKeywords'
                                                        @click.stop='saveKeywords'
                                                    >
                                                        {{ savingKeywords ? 'Saving...' : 'Save' }}
                                                    </TablerButton>
                                                </div>
                                            </template>

                                            <Keywords
                                                v-else
                                                :keywords='pkg.keywords'
                                                placeholder='No hashtags provided'
                                                tone='accent'
                                            />
                                        </TablerBorder>
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
                            </TablerBorder>
                        </div>
                        <div class='col-12'>
                            <TablerBorder class='cloudtak-bg text-white'>
                                <template #label>
                                    <p class='text-uppercase text-white-50 small mb-0'>
                                        Quick Actions
                                    </p>
                                </template>
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
                                    class='btn btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2'
                                    :disabled='!shareFeat'
                                    @click='mode = "share"'
                                >
                                    <IconShare2
                                        :size='20'
                                        stroke='1'
                                    />
                                    <span>Share Package</span>
                                </button>
                            </TablerBorder>
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
import type { Server, Package, Feature } from '../../../../src/types.ts';
import { server, stdurl, std } from '../../../std.ts';
import Share from '../util/Share.vue';
import GroupSelectInline from '../util/GroupSelectInline.vue';
import Keywords from '../util/Keywords.vue';
import TagEntry from '../util/TagEntry.vue';
import GroupManager from '../../../base/group.ts';
import timeDiff from '../../../timediff.ts';
import {
    TablerAlert,
    TablerBadge,
    TablerBorder,
    TablerButton,
    TablerDelete,
    TablerInput,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconShare2,
    IconDownload,
    IconFileImport,
    IconPackage,
    IconPencil
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';
import ProfileConfig from '../../../base/profile.ts';

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const relative = ref(true);
const expirationRelative = ref(true);
const loading = ref(true);
const error = ref<Error | undefined>()
const mode = ref('default');
const serverConfig = ref<Server | undefined>();
const pkg = ref<Package | undefined>();
const editingChannels = ref(false);
const savingChannels = ref(false);
const channelDraft = ref<string[]>([]);
const editingKeywords = ref(false);
const savingKeywords = ref(false);
const keywordDraft = ref<string[]>([]);
const editingExpiration = ref(false);
const savingExpiration = ref(false);
const expirationDraft = ref('');
const activeChannels = ref<string[]>([]);

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

const canEditPackage = computed(() => {
    if (!pkg.value || !profile.value.username) return false;

    if (profile.value.system_admin) return true;

    return pkg.value.channels.some((channel) => activeChannels.value.includes(channel));
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

    const normalizedExpiration = normalizeDateValue(expiration);

    if (typeof normalizedExpiration === 'number' && normalizedExpiration === -1) return null;
    if (typeof normalizedExpiration === 'string' && normalizedExpiration.trim() === '') return null;

    return expirationRelative.value
        ? timeDiff(normalizedExpiration)
        : formatDateValue(normalizedExpiration);
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
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function normalizeDateValue(value: number | string): number | string {
    if (typeof value === 'number') {
        return value > 0 && value < 1_000_000_000_000 ? value * 1000 : value;
    }

    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '-1') return trimmed;

    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue)) {
        return numericValue > 0 && numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
    }

    return value;
}


onMounted(async () => {
    const [username, takCallsign, systemAdmin, channels, loadedServer] = await Promise.all([
        ProfileConfig.get('username'),
        ProfileConfig.get('tak_callsign'),
        ProfileConfig.get('system_admin'),
        GroupManager.list({ active: true }),
        mapStore.worker.profile.loadServer()
    ]);

    profile.value = {
        username: username?.value as string | undefined,
        tak_callsign: takCallsign?.value as string | undefined,
        system_admin: systemAdmin?.value as boolean | undefined
    };

    activeChannels.value = channels.map((channel) => channel.name);
    serverConfig.value = loadedServer;
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
        if (!editingChannels.value) channelDraft.value = [...res.data.channels];
        if (!editingKeywords.value) keywordDraft.value = [...res.data.keywords];
        if (!editingExpiration.value) expirationDraft.value = toDatetimeLocal(res.data.expiration);

        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }

    loading.value = false;
}

function startEditingChannels(): void {
    if (!pkg.value || !canEditPackage.value) return;

    channelDraft.value = [...pkg.value.channels];
    editingChannels.value = true;
}

function cancelEditingChannels(): void {
    editingChannels.value = false;
    channelDraft.value = pkg.value ? [...pkg.value.channels] : [];
}

async function saveChannels(): Promise<void> {
    try {
        savingChannels.value = true;

        const updated = await patchPackage({ channels: channelDraft.value });

        channelDraft.value = [...updated.channels];
        editingChannels.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        savingChannels.value = false;
    }
}

function startEditingKeywords(): void {
    if (!pkg.value || !canEditPackage.value) return;

    keywordDraft.value = [...pkg.value.keywords];
    editingKeywords.value = true;
}

function cancelEditingKeywords(): void {
    editingKeywords.value = false;
    keywordDraft.value = pkg.value ? [...pkg.value.keywords] : [];
}

async function saveKeywords(): Promise<void> {
    try {
        savingKeywords.value = true;

        const updated = await patchPackage({ keywords: keywordDraft.value });

        keywordDraft.value = [...updated.keywords];
        editingKeywords.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        savingKeywords.value = false;
    }
}

function startEditingExpiration(): void {
    if (!pkg.value || !canEditPackage.value) return;

    expirationDraft.value = toDatetimeLocal(pkg.value.expiration);
    editingExpiration.value = true;
}

function cancelEditingExpiration(): void {
    editingExpiration.value = false;
    expirationDraft.value = pkg.value ? toDatetimeLocal(pkg.value.expiration) : '';
}

async function clearExpiration(): Promise<void> {
    try {
        savingExpiration.value = true;

        const updated = await patchPackage({ expiration: -1 });

        expirationDraft.value = toDatetimeLocal(updated.expiration);
        editingExpiration.value = false;
        expirationRelative.value = true;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        savingExpiration.value = false;
    }
}

async function saveExpiration(): Promise<void> {
    try {
        savingExpiration.value = true;

        const trimmed = expirationDraft.value.trim();

        if (!trimmed) {
            await clearExpiration();
            return;
        }

        const time = new Date(trimmed).getTime();
        if (Number.isNaN(time)) throw new Error('Invalid expiration date');

        const updated = await patchPackage({ expiration: Math.floor(time / 1000) });

        expirationDraft.value = toDatetimeLocal(updated.expiration);
        editingExpiration.value = false;
        expirationRelative.value = true;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        savingExpiration.value = false;
    }
}

async function patchPackage(body: {
    channels?: string[];
    keywords?: string[];
    expiration?: number;
}): Promise<Package> {
    if (!pkg.value) throw new Error('Package not loaded');

    const res = await server.PATCH('/api/marti/package/{:uid}', {
        params: {
            path: {
                ':uid': pkg.value.uid
            }
        },
        body
    });

    if (res.error) throw new Error(res.error.message);

    pkg.value = res.data;
    return res.data;
}

function toDatetimeLocal(value: number | string | null | undefined): string {
    if (value === undefined || value === null) return '';

    const normalized = normalizeDateValue(value);
    if (typeof normalized === 'number' && normalized === -1) return '';
    if (typeof normalized === 'string' && (normalized.trim() === '' || normalized.trim() === '-1')) return '';

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';

    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 16);
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
.menu-package__inline-button {
    --bs-btn-color: inherit;
    --bs-btn-hover-color: inherit;
    --bs-btn-active-color: inherit;
    text-decoration: none;
}

.menu-package__inline-button:focus-visible {
    outline: 2px solid rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.7);
    outline-offset: 2px;
    border-radius: 0.25rem;
}
</style>
