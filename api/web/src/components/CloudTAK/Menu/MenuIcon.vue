<template>
    <MenuTemplate name='Icon'>
        <template #buttons>
            <div class='d-flex align-items-center gap-2'>
                <TablerDelete
                    v-if='iconset.username || isSystemAdmin'
                    displaytype='icon'
                    @delete='deleteIcon'
                />

                <TablerIconButton
                    v-if='iconset.username || isSystemAdmin'
                    title='Edit'
                    @click='editModal = icon'
                >
                    <IconSettings
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <template v-else>
                <div class='container-fluid px-2 px-sm-3 py-4'>
                    <div class='row gy-3 gx-0 gx-lg-3'>
                        <div class='col-12'>
                            <div class='card h-100 bg-dark text-white border border-light-subtle shadow-sm'>
                                <div class='card-body d-flex flex-column gap-4'>
                                    <div class='d-flex align-items-center gap-3'>
                                        <div class='rounded bg-white p-1 d-flex align-items-center justify-content-center'>
                                            <img
                                                :src='iconurl(icon)'
                                                width='32'
                                                height='32'
                                                style='object-fit: contain;'
                                            >
                                        </div>
                                        <div class='flex-grow-1'>
                                            <p class='text-uppercase text-white-50 small mb-1'>
                                                Icon
                                            </p>
                                            <h2
                                                class='h4 mb-0 text-truncate'
                                                style='max-width: calc(100% - 48px);'
                                                v-text='icon.name'
                                            />
                                        </div>
                                    </div>

                                    <div class='row gy-3 gx-0 gx-sm-3'>
                                        <div class='col-12'>
                                            <small class='text-uppercase text-white-50 d-block mb-1'>Iconset</small>
                                            <router-link
                                                :to='`/menu/iconset/${icon.iconset}`'
                                                class='text-start text-blue fw-semibold p-0 text-decoration-none'
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
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>

    <IconEditModal
        v-if='editModal'
        :icon='editModal'
        @close='refresh'
    />
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import IconManager from '../../../stores/modules/icons.ts';
import {
    TablerDelete,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import IconEditModal from './Icon/EditModal.vue';

const route = useRoute();
const router = useRouter();

const mapStore = useMapStore();

const loading = ref(true);
const editModal = ref(false);
const isSystemAdmin = ref(false);
    
const iconset = ref({});
const icon = ref({
    id: false
});

onMounted(async () => {
    isSystemAdmin.value = await mapStore.worker.profile.isSystemAdmin();
    await refresh();
});

async function refresh() {
    editModal.value = false;
    loading.value = true;
    await fetchIconset();
    await fetch();
    loading.value = false;
}

function iconurl() {
    const url = stdurl(`/api/iconset/${icon.value.iconset}/icon/${encodeURIComponent(icon.value.name)}/raw`);
    url.searchParams.append('token', localStorage.token);
    return String(url);
}

async function fetch() {
    const url = stdurl(`/api/iconset/${route.params.iconset}/icon/${encodeURIComponent(route.params.icon)}`);
    icon.value = await std(url);
}

async function fetchIconset() {
    const is = await IconManager.from(route.params.iconset);
    if (is) {
        iconset.value = is;
    } else {
        const url = stdurl(`/api/iconset/${route.params.iconset}`);
        iconset.value = await std(url);
    }
}

async function deleteIcon() {
    loading.value = true;
    const url = stdurl(`/api/iconset/${route.params.iconset}/icon/${encodeURIComponent(route.params.icon)}`);
    iconset.value = await std(url, {
        method: 'DELETE'
    });
    router.push(`/iconset/${route.params.iconset}`);
}
</script>
