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
                @click.stop='IconsetCache.download(iconset.uid)'
            >
                <IconDownload
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerRefreshButton
                :loading='loading'
                @click='syncIconset'
            />

            <TablerDelete
                v-if='iconset.username || isSystemAdmin'
                displaytype='icon'
                @delete='deleteIconset'
            />
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <div
                v-else
                class='col-lg-12'
            >
                <TablerAlert
                    v-if='syncError'
                    class='mb-3'
                    :err='syncError'
                />
                <CombinedIcons
                    :iconset='iconset.uid'
                    :labels='false'
                    :refresh-key='refreshKey'
                />
            </div>
        </template>
    </MenuTemplate>

    <IconsetEditModal
        v-if='editIconsetModal'
        :icon='editIconsetModal'
        @close='syncIconset'
    />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import IconsetCache from '../../../base/iconset.ts';
import CombinedIcons from '../util/Icons.vue';
import { useMapStore } from '../../../stores/map.ts';
import {
    TablerAlert,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
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
const mapStore = useMapStore();

const loading = ref(true);
const editIconsetModal = ref<Iconset | null>(null);
const isSystemAdmin = ref(false);
const error = ref<Error | undefined>(undefined);
const syncError = ref<Error | undefined>(undefined);
const refreshKey = ref(0);
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
    error.value = undefined;
    editIconsetModal.value = null;

    try {
        await fetchIconset();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

async function fetchIconset(): Promise<void> {
    const cached = await IconsetCache.from(String(route.params.iconset));
    if (!cached) throw new Error('Iconset not available offline. Refresh to sync this iconset.');

    iconset.value = {
        ...iconset.value,
        ...cached
    };
}

async function syncIconset(): Promise<void> {
    loading.value = true;
    syncError.value = undefined;

    try {
        await mapStore.icons.addIconset(String(route.params.iconset), { force: true });
        refreshKey.value += 1;
    } catch (err) {
        syncError.value = err instanceof Error ? err : new Error(String(err));
    }

    await refresh();
}

async function deleteIconset(): Promise<void> {
    loading.value = true;
    await mapStore.icons.deleteIconset(String(route.params.iconset));
    router.push('/menu/iconsets');
}
</script>
