<template>
    <MenuTemplate name='Icon'>
        <template #buttons>
            <div class='d-flex align-items-center gap-2'>
                <TablerDelete
                    v-if='(iconset.username || isSystemAdmin) && disabled'
                    displaytype='icon'
                    @delete='deleteIcon'
                />

                <TablerIconButton
                    v-if='(iconset.username || isSystemAdmin) && disabled'
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
            <template v-else>
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
                        <UploadLogo
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
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { server } from '../../../std.ts';
import IconManager from '../../../stores/modules/icons.ts';
import {
    TablerBorder,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerInput
} from '@tak-ps/vue-tabler';
import { IconPencil } from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import UploadLogo from '../../util/UploadLogo.vue';
import ProfileConfig from '../../../base/profile.ts';
import type { Iconset } from '../../../types.ts';

interface IconDraft {
    id?: number;
    name: string;
    data: string;
    iconset?: string;
    type2525b: string | null;
}

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const isSystemAdmin = ref(false);
const disabled = ref(true);

const iconset = ref<Pick<Iconset, 'name' | 'username'>>({ name: '', username: null });
const icon = ref<IconDraft>({ name: '', data: '', type2525b: null });

onMounted(async () => {
    const isSysAdmin = await ProfileConfig.get('system_admin');
    isSystemAdmin.value = isSysAdmin?.value ?? false;
    await refresh();
});

async function refresh(): Promise<void> {
    loading.value = true;

    await fetchIconset();

    if (route.params.icon !== 'new') {
        disabled.value = true;
        await fetch();
    } else {
        disabled.value = false;
    }

    loading.value = false;
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

        icon.value = res.data;
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
        icon.value = created;
        router.push(`/menu/iconset/${route.params.iconset}/${created.id}`);
    }

    disabled.value = true;
    await refresh();
}

async function fetch(): Promise<void> {
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

    const res = result.data;

    if (res.name.endsWith('.svg') && !res.data.startsWith('data:image/svg+xml;base64,')) {
        res.data = `data:image/svg+xml;base64,${res.data}`;
    } else if (res.name.endsWith('.png') && !res.data.startsWith('data:image/png;base64,')) {
        res.data = `data:image/png;base64,${res.data}`;
    }

    icon.value = res;
}

async function fetchIconset(): Promise<void> {
    const cached = await IconManager.from(String(route.params.iconset));
    if (cached) {
        iconset.value = cached;
    } else {
        const res = await server.GET('/api/iconset/{:iconset}', {
            params: {
                path: {
                    ':iconset': String(route.params.iconset)
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to fetch iconset');

        iconset.value = res.data;
    }
}

async function deleteIcon(): Promise<void> {
    loading.value = true;
    const res = await server.DELETE('/api/iconset/{:iconset}/icon/{:icon}', {
        params: {
            path: {
                ':iconset': String(route.params.iconset),
                ':icon': Number(route.params.icon)
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    router.push(`/menu/iconset/${route.params.iconset}`);
}

function updateName(name: string): void {
    icon.value.name = name;
}
</script>
