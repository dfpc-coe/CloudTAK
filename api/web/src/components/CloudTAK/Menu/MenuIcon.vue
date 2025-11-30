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
                            v-model='icon.type2525b'
                            label='2525B Type'
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
                    class='container-fluid px-2 px-sm-3 py-4'
                >
                    <div class='row gy-3 gx-0 gx-lg-3'>
                        <div class='col-12'>
                            <div class='card h-100 bg-dark text-white border border-light-subtle shadow-sm'>
                                <div class='card-body d-flex flex-column gap-4'>
                                    <div class='d-flex align-items-center gap-3'>
                                        <div class='rounded bg-white p-1 d-flex align-items-center justify-content-center'>
                                            <img
                                                :src='icon.data'
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
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
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
    TablerIconButton,
    TablerInput
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import UploadLogo from '../../util/UploadLogo.vue';

const route = useRoute();
const router = useRouter();

const mapStore = useMapStore();

const loading = ref(true);
const isSystemAdmin = ref(false);

const disabled = ref(true);

const iconset = ref({});
const icon = ref({
    id: false
});

onMounted(async () => {
    isSystemAdmin.value = await mapStore.worker.profile.isSystemAdmin();
    await refresh();
});

async function refresh() {
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

async function submit() {
    if (icon.value.id) {
        const url = await stdurl(`/api/iconset/${route.params.iconset}/icon/${icon.value.id}`);

        icon.value = await std(url, {
            method: 'PATCH',
            body: icon.value
        });
    } else {
        const url = await stdurl(`/api/iconset/${route.params.iconset}/icon`);

        icon.value = await std(url, {
            method: 'POST',
            body: icon.value
        });

        router.push(`/menu/iconset/${route.params.iconset}/${icon.value.id}`);
    }

    disabled.value = true;
    await refresh();
}

async function fetch() {
    const url = stdurl(`/api/iconset/${route.params.iconset}/icon/${route.params.icon}`);
    const res = await std(url);

    if (res.name.endsWith('.svg') && !res.data.startsWith('data:image/svg+xml;base64,')) {
        res.data = `data:image/svg+xml;base64,${res.data}`;
    } else if (res.name.endsWith('.png') && !res.data.startsWith('data:image/png;base64,')) {
        res.data = `data:image/png;base64,${res.data}`;
    }

    icon.value = res;
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
    const url = stdurl(`/api/iconset/${route.params.iconset}/icon/${route.params.icon}`);
    iconset.value = await std(url, {
        method: 'DELETE'
    });
    router.push(`/menu/iconset/${route.params.iconset}`);
}

function updateName(name) {
    icon.value.name = name;
}
</script>
