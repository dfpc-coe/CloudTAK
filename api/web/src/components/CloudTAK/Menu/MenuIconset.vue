<template>
    <MenuTemplate :name='iconset.name'>
        <template #buttons>
            <TablerIconButton
                v-if='iconset.username || isSystemAdmin'
                title='Create Icon'
                @click='router.push(`/menu/iconset/${iconset.uid}/new`)'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='iconset.username || isSystemAdmin'
                title='Settings'
                @click='editIconsetModal = iconset'
            >
                <IconSettings
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                title='Download TAK Zip'
                @click.stop='download'
            >
                <IconDownload
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerDelete
                v-if='iconset.username || isSystemAdmin'
                displaytype='icon'
                @delete='deleteIconset'
            />
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='col-lg-12'
            >
                <CombinedIcons
                    v-if='!loading'
                    :iconset='iconset.uid'
                    :labels='false'
                />
            </div>
        </template>
    </MenuTemplate>

    <IconsetEditModal
        v-if='editIconsetModal'
        :icon='editIconsetModal'
        @close='refresh'
    />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import CombinedIcons from '../util/Icons.vue';
import {
    TablerDelete,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconSettings,
    IconDownload,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import IconsetEditModal from './Iconset/EditModal.vue';
import ProfileConfig from '../../../base/profile.ts';
import type { Iconset } from '../../../types.ts';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const editIconsetModal = ref<Iconset | null>(null);
const isSystemAdmin = ref(false);
const iconset = ref<Iconset>({
    uid: '',
    created: '',
    updated: '',
    version: 0,
    name: '',
    username: null,
    username_internal: false,
    default_group: null,
    default_friendly: null,
    default_hostile: null,
    default_neutral: null,
    default_unknown: null,
    skip_resize: false,
});

onMounted(async () => {
    await refresh();
    const isSysAdmin = await ProfileConfig.get('system_admin');
    isSystemAdmin.value = isSysAdmin?.value ?? false;
});

async function refresh(): Promise<void> {
    loading.value = true;
    editIconsetModal.value = null;
    await fetchIconset();
    loading.value = false;
}

async function download(): Promise<void> {
    await std(`/api/iconset/${iconset.value.uid}?format=zip&download=true&token=${localStorage.token}`, {
        download: true
    });
}

async function fetchIconset(): Promise<void> {
    loading.value = true;
    const url = stdurl(`/api/iconset/${route.params.iconset}`);
    iconset.value = await std(url) as Iconset;
    loading.value = false;
}

async function deleteIconset(): Promise<void> {
    loading.value = true;
    const url = stdurl(`/api/iconset/${route.params.iconset}`);
    await std(url, { method: 'DELETE' });
    router.push('/menu/iconsets');
}
</script>
