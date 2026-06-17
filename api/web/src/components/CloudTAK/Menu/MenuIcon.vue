<template>
    <MenuTemplate name='Icon'>
        <template #buttons>
            <div class='d-flex align-items-center gap-2'>
                <TablerRefreshButton
                    v-if='route.params.icon !== "new"'
                    :loading='loading'
                    @click='syncIconset'
                />

                <TablerDelete
                    v-if='(iconset.username || isSystemAdmin) && disabled && !!icon.id'
                    displaytype='icon'
                    @delete='deleteIcon'
                />

                <TablerIconButton
                    v-if='(iconset.username || isSystemAdmin) && disabled && !!icon.id'
                    title='Edit'
                    @click='disabled = false'
                >
                    <IconPencil
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else>
                <TablerAlert
                    v-if='syncError'
                    class='mb-3'
                    :err='syncError'
                />
                <div
                    v-if='disabled === false'
                    class='row mx-0 gap-4'
                >
                    <div class='col-12'>
                        <TablerInput
                            v-model='icon.name'
                            label='Name'
                        />
                    </div>

                    <div class='col-12'>
                        <TablerUploadLogo
                            v-model='icon.data'
                            label='Icon Data'
                            @file-name='updateName'
                        />
                    </div>

                    <div class='col-12'>
                        <TablerInput
                            :model-value='icon.type2525b ?? ""'
                            label='2525B Type'
                            @update:model-value='icon.type2525b = $event ? String($event) : null'
                        />
                    </div>

                    <div class='d-flex'>
                        <div class='ms-auto d-flex gap-2'>
                            <div
                                v-if='icon.id'
                                class='btn btn-secondary'
                                @click='refresh'
                            >
                                Cancel
                            </div>
                            <div
                                class='btn btn-primary'
                                @click='submit'
                            >
                                Submit
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    v-else
                    class='container-fluid py-4'
                >
                    <div class='row gy-3 gx-0 gx-lg-3'>
                        <div class='col-12'>
                            <TablerBorder
                                class='cloudtak-bg text-white'
                                gap='lg'
                            >
                                <div class='d-flex align-items-center gap-3'>
                                    <div class='d-flex align-items-center justify-content-center'>
                                        <img
                                            :src='icon.data'
                                            class='img-thumbnail'
                                            style='background-color: rgb(30, 41, 59);'
                                            width='32'
                                            height='32'
                                        >
                                    </div>
                                    <div class='flex-grow-1'>
                                        <p class='text-uppercase text-white-50 small mb-1'>
                                            Icon
                                        </p>
                                        <h2
                                            class='h4 mb-0 text-break'
                                            v-text='icon.name'
                                        />
                                    </div>
                                </div>

                                <div class='row gy-3 gx-0 gx-sm-3'>
                                    <div class='col-12'>
                                        <small class='text-uppercase text-white-50 d-block mb-1'>Iconset</small>
                                        <p
                                            class='text-start text-blue fw-semibold cursor-pointer p-0 text-decoration-none'
                                            @click='router.push(`/menu/iconset/${icon.iconset}`)'
                                            v-text='iconset.name'
                                        />
                                    </div>
                                    <div class='col-12'>
                                        <small class='text-uppercase text-white-50 d-block mb-1'>Type 2525b</small>
                                        <p
                                            class='text-start text-white fw-semibold p-0 text-decoration-none'
                                            v-text='icon.type2525b || "None"'
                                        />
                                    </div>
                                </div>
                            </TablerBorder>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { server } from '../../../std.ts';
import IconCache from '../../../base/icon.ts';
import IconsetCache from '../../../base/iconset.ts';
import { useMapStore } from '../../../stores/map.ts';
import {
    TablerAlert,
    TablerBorder,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
    TablerInput,
    TablerUploadLogo
} from '@tak-ps/vue-tabler';
import { IconPencil } from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import ProfileConfig from '../../../base/profile.ts';
import type { Iconset } from '../../../types.ts';
import type { DBIcon } from '../../../database.ts';

interface IconDraft {
    id?: number;
    name: string;
    data: string;
    iconset?: string;
    type2525b: string | null;
}

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const loading = ref(true);
const isSystemAdmin = ref(false);
const disabled = ref(true);
const error = ref<Error | undefined>(undefined);
const syncError = ref<Error | undefined>(undefined);
const iconObjectUrl = ref('');

const iconset = ref<Pick<Iconset, 'name' | 'username'>>({ name: '', username: null });
const icon = ref<IconDraft>({ name: '', data: '', type2525b: null });

onMounted(async () => {
    const isSysAdmin = await ProfileConfig.get('system_admin');
    isSystemAdmin.value = isSysAdmin?.value ?? false;
    await refresh();
});

onUnmounted(() => {
    revokeIconObjectUrl();
});

function revokeIconObjectUrl(): void {
    if (iconObjectUrl.value) {
        URL.revokeObjectURL(iconObjectUrl.value);
        iconObjectUrl.value = '';
    }
}

async function refresh(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        await fetchIconset();

        if (route.params.icon !== 'new') {
            disabled.value = true;
            await fetch();
        } else {
            disabled.value = false;
            revokeIconObjectUrl();
            icon.value = { name: '', data: '', type2525b: null, iconset: String(route.params.iconset) };
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

async function submit(): Promise<void> {
    if (icon.value.id) {
        const res = await server.PATCH('/api/iconset/{:iconset}/icon/{:icon}', {
            params: {
                path: {
                    ':iconset': String(route.params.iconset),
                    ':icon': icon.value.id
                }
            },
            body: {
                name: icon.value.name,
                data: icon.value.data,
                type2525b: icon.value.type2525b
            }
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to update icon');

        icon.value = normalizeRemoteIcon(res.data);
    } else {
        const res = await server.POST('/api/iconset/{:iconset}/icon', {
            params: {
                path: {
                    ':iconset': String(route.params.iconset)
                },
                query: {
                    regen: true
                }
            },
            body: {
                name: icon.value.name,
                data: icon.value.data,
                type2525b: icon.value.type2525b
            }
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to create icon');

        const created = res.data;
        icon.value = normalizeRemoteIcon(created);
    }

    await mapStore.icons.addIconset(String(route.params.iconset), { force: true });
    disabled.value = true;

    const routeIcon = stripExt(icon.value.name);
    if (String(route.params.icon) !== routeIcon) {
        await router.replace(`/menu/iconset/${route.params.iconset}/${encodeURIComponent(routeIcon)}`);
    }

    await refresh();
}

async function fetch(): Promise<void> {
    const cached = await fetchCachedIcon();
    if (cached) {
        icon.value = cached;
        return;
    }

    if (!isLegacyNumericRoute()) {
        throw new Error('Icon not available offline. Refresh to sync this iconset.');
    }

    const result = await server.GET('/api/iconset/{:iconset}/icon/{:icon}', {
        params: {
            path: {
                ':iconset': String(route.params.iconset),
                ':icon': String(route.params.icon)
            }
        }
    });

    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error('Failed to fetch icon');

    icon.value = normalizeRemoteIcon(result.data);
}

async function fetchIconset(): Promise<void> {
    const cached = await IconsetCache.from(String(route.params.iconset));
    if (!cached) throw new Error('Iconset not available offline. Refresh to sync this iconset.');

    iconset.value = {
        name: cached.name,
        username: cached.username
    };
}

async function deleteIcon(): Promise<void> {
    if (!icon.value.id) throw new Error('Icon cannot be deleted until it has been synced from the server.');

    loading.value = true;
    const res = await server.DELETE('/api/iconset/{:iconset}/icon/{:icon}', {
        params: {
            path: {
                ':iconset': String(route.params.iconset),
                ':icon': icon.value.id
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    await mapStore.icons.addIconset(String(route.params.iconset), { force: true });
    router.push(`/menu/iconset/${route.params.iconset}`);
}

async function syncIconset(): Promise<void> {
    loading.value = true;
    syncError.value = undefined;

    try {
        await mapStore.icons.addIconset(String(route.params.iconset), { force: true });
    } catch (err) {
        syncError.value = err instanceof Error ? err : new Error(String(err));
    }

    await refresh();
}

async function fetchCachedIcon(): Promise<IconDraft | undefined> {
    const key = currentIconCacheKey();
    if (!key) return undefined;

    const cached = await IconCache.get(key);
    if (!cached) return undefined;

    return toIconDraft(cached);
}

function currentIconCacheKey(): string | undefined {
    if (route.params.icon === 'new') return undefined;
    if (isLegacyNumericRoute()) return undefined;

    const raw = decodeURIComponent(String(route.params.icon));
    return `${String(route.params.iconset)}:${stripExt(raw)}`;
}

function isLegacyNumericRoute(): boolean {
    return !Number.isNaN(Number(route.params.icon));
}

function toIconDraft(iconRow: DBIcon): IconDraft {
    revokeIconObjectUrl();
    iconObjectUrl.value = URL.createObjectURL(iconRow.data);

    return {
        name: iconRow.path,
        data: iconObjectUrl.value,
        iconset: iconRow.iconset,
        type2525b: iconRow.type2525b
    };
}

function normalizeRemoteIcon(remote: IconDraft): IconDraft {
    revokeIconObjectUrl();

    if (remote.name.endsWith('.svg') && !remote.data.startsWith('data:image/svg+xml;base64,')) {
        remote.data = `data:image/svg+xml;base64,${remote.data}`;
    } else if (remote.name.endsWith('.png') && !remote.data.startsWith('data:image/png;base64,')) {
        remote.data = `data:image/png;base64,${remote.data}`;
    }

    remote.name = stripExt(remote.name);
    return remote;
}

function stripExt(name: string): string {
    return name.replace(/\.(png|svg|jpg|jpeg|gif)$/i, '');
}

function updateName(name: string): void {
    icon.value.name = name;
}
</script>
