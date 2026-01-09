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
                <div class='container-fluid px-2 px-sm-3 py-4'>
                    <div class='card border border-light-subtle bg-dark text-white shadow-sm'>
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
                <div class='container-fluid px-2 px-sm-3 py-4'>
                    <div class='row gy-3 gx-0 gx-lg-3'>
                        <div class='col-12'>
                            <div class='card h-100 bg-dark text-white border border-light-subtle shadow-sm'>
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
                                        <div class='col-12'>
                                            <small class='text-uppercase text-white-50 d-block mb-1'>Created By</small>
                                            <p
                                                class='text-start text-white fw-semibold p-0 text-decoration-none'
                                                v-text='pkg.username'
                                            />
                                        </div>
                                        <div class='col-12 col-lg-6'>
                                            <small class='text-uppercase text-white-50 d-block'>Created</small>
                                            <button
                                                type='button'
                                                class='btn btn-link text-start text-white fw-semibold p-0 text-decoration-none'
                                                @click='relative = !relative'
                                            >
                                                {{ relative ? timeDiff(pkg.created) : pkg.created }}
                                            </button>
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
                                        <div class='col-12'>
                                            <small class='text-uppercase text-white-50 d-block mb-2'>Hashtags</small>
                                            <Keywords :keywords='pkg.keywords' />
                                            <p
                                                v-if='!pkg.keywords || !pkg.keywords.length'
                                                class='text-white-50 mb-0'
                                            >
                                                No hashtags provided
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class='col-12'>
                            <div class='card h-100 bg-dark text-white border border-light-subtle shadow-sm'>
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
import type { Profile, Server, Package, Feature } from '../../../../src/types.ts';
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

const profile = ref<Profile | undefined>(undefined);

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


onMounted(async () => {
    profile.value = await mapStore.worker.profile.load();
    serverConfig.value = await mapStore.worker.profile.loadServer();
    await fetch();
});

async function downloadFile(): Promise<void> {
    if (!pkg.value) return;

    const url = stdurl(`/api/marti/api/files/${pkg.value.hash}`)
    url.searchParams.append('token', localStorage.token);
    url.searchParams.append('name', pkg.value.name + '.zip');

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
        throw err;
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
