<template>
    <MenuTemplate name='Iconsets'>
        <template #buttons>
            <TablerIconButton
                title='Create Iconset'
                @click='editModal = true'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='!upload'
                title='Zip Upload'
                @click='upload = true'
            >
                <IconFileUpload
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerRefreshButton
                :loading='loading'
                @click='refreshList'
            />
        </template>
        <template #default>
            <template v-if='upload'>
                <div class='my-4'>
                    <Upload
                        method='PUT'
                        :url='stdurl(`/api/import`)'
                        @done='processUpload($event)'
                        @cancel='upload = false'
                        @err='throws($event)'
                    />
                </div>
            </template>
            <template v-else>
                <TablerAlert
                    v-if='syncError'
                    class='mt-3'
                    :err='syncError'
                />
                <IconCombineds />
            </template>
        </template>
    </MenuTemplate>

    <IconsetEditModal
        v-if='editModal'
        @close='editModal = false'
    />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import { stdurl } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import Upload from '../../util/Upload.vue';
import IconCombineds from '../util/Icons.vue';
import IconsetEditModal from './Iconset/EditModal.vue';
import {
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconFileUpload,
    IconPlus
} from '@tabler/icons-vue';

interface ImportUploadResponse {
    imports: {
        file: string;
        uid: string;
        ext: string;
    }[];
}

const router = useRouter();
const mapStore = useMapStore();

const syncError = ref<Error | undefined>(undefined);
const loading = ref(false);
const upload = ref(false);
const editModal = ref(false);

function throws(err: Error): void {
    throw err;
}

function isImportUploadResponse(val: unknown): val is ImportUploadResponse {
    return (
        typeof val === 'object' &&
        val !== null &&
        'imports' in val &&
        Array.isArray((val as { imports: unknown }).imports)
    );
}

function processUpload(body: unknown): void {
    if (isImportUploadResponse(body) && body.imports.length > 0) {
        router.push(`/menu/imports/${body.imports[0].uid}`);
    }
}

async function refreshList(): Promise<void> {
    loading.value = true;
    syncError.value = undefined;

    try {
        await mapStore.icons.refresh();
    } catch (err) {
        syncError.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
