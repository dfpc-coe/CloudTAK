<template>
    <MenuTemplate :name='iconset.name'>
        <template #buttons>
            <TablerIconButton
                v-if='iconset.username || profileStore.profile.system_admin'
                title='Create Icon'
                @click='editIconModal = {}'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='iconset.username || profileStore.profile.system_admin'
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
                v-if='iconset.username || profileStore.profile.system_admin'
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
    <IconEditModal
        v-if='editIconModal'
        :icon='editIconModal'
        @close='refresh'
    />
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '/src/std.ts';
import CombinedIcons from '../util/Icons.vue'
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
import IconEditModal from './Icon/EditModal.vue';
import IconsetEditModal from './Iconset/EditModal.vue';
import { useProfileStore } from '/src/stores/profile.ts';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const editIconsetModal = ref(false);
const editIconModal = ref(false);
const iconset = ref({
    uid: ''
});

const profileStore = useProfileStore();

onMounted(async () => {
    await refresh();
});

async function refresh() {
    loading.value = true;
    editIconModal.value = false;
    editIconsetModal.value = false;
    await fetchIconset();
    loading.value = false;
}

function download() {
    window.location.href = stdurl(`api/iconset/${iconset.value.uid}?format=zip&download=true&token=${localStorage.token}`);
}

async function fetchIconset() {
    loading.value = true;
    const url = stdurl(`/api/iconset/${route.params.iconset}`);
    iconset.value = await std(url);
    loading.value = false;
}

async function deleteIconset() {
    loading.value = true;
    const url = stdurl(`/api/iconset/${route.params.iconset}`);
    iconset.value = await std(url, {
        method: 'DELETE'
    });

    router.push('/menu/iconset');
}
</script>
