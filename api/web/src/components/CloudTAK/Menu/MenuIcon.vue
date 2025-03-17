<template>
    <MenuTemplate :name='icon.name'>
        <template #buttons>
            <TablerDelete
                v-if='iconset.username || profile.system_admin'
                displaytype='icon'
                @delete='deleteIcon'
            />
            <IconSettings
                v-if='iconset.username || profile.system_admin'
                :size='32'
                stroke='1'
                class='cursor-pointer'
                @click='editModal = icon'
            />
        </template>
        <template #default>
            <div class='mx-4'>
                <TablerLoading v-if='loading' />
                <template v-else>
                    <div class='pb-4'>
                        <div class='d-flex justify-content-center mt-3'>
                            <img
                                :src='iconurl(icon)'
                                width='64'
                            >
                        </div>
                    </div>
                    <div class='datagrid'>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Iconset
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='icon.iconset'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Name
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='icon.name'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Type 2525b
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='icon.type2525b || "None"'
                            />
                        </div>
                    </div>
                </template>
            </div>
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
import {
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import IconEditModal from './Icon/EditModal.vue';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const editModal = ref(false);
    
const iconset = ref({});
const icon = ref({
    id: false
});

onMounted(async () => {
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
    const url = stdurl(`/api/iconset/${route.params.iconset}`);
    iconset.value = await std(url);
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
