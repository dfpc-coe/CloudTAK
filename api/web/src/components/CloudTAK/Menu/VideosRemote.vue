<template>
    <MenuTemplate
        name='Remote Video Connection'
        :loading='loading'
        :err='err'
    >
        <template #buttons>
            <TablerDelete
                v-if='route.params.connectionid !== "new"'
                displaytype='icon'
                @delete='deleteConnection'
            />
        </template>
        <template #default>
            <div class='row g-2 px-2'>
                <div class='col-12'>
                    <TablerInput
                        label='Alias'
                        v-model='connection.alias'
                    >
                        <TablerToggle
                            label='Active'
                            v-model='connection.active'
                        />
                    </TablerInput>
                </div>
                <div class='col-12 d-flex pt-3'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='saveConnection'
                        >
                            Save Feed
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import MenuTemplate from '../util/MenuTemplate.vue';
import type { VideoConnection, VideoConnection_Create } from '../../../types.ts';
import { std } from '../../../std.ts';
import { useRoute, useRouter } from 'vue-router';
import {
    TablerInput,
    TablerDelete,
    TablerToggle,
} from '@tak-ps/vue-tabler';

import { ref, onMounted } from 'vue'

const route = useRoute();
const router = useRouter();
const loading = ref(String(route.params.connectionid) !== "new");
const err = ref<Error | undefined>(undefined);
const connection = ref<VideoConnection | VideoConnection_Create>({
    active: true,
    alias: '',
    feeds: []
})

onMounted(async () => {
    if (String(route.params.connectionid) !== "new") {
        await fetchConnection()
    }
});

async function fetchConnection() {
    loading.value = true;

    try {
        connection.value = await std(`/api/marti/video/${route.params.connectionid}`, {
            method: 'GET'
        }) as VideoConnection;

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function saveConnection() {
    loading.value = true;

    try {
        await std('/api/marti/video', {
            method: 'POST',
            body: connection.value
        });

        router.push(`/menu/videos`)

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteConnection(): Promise<void> {
    loading.value = true;

    try {
        await std(`/api/marti/video/${route.params.connectionid}`, {
            method: 'DELETE'
        });

        router.push(`/menu/videos`)
    } catch (err) {
        loading.value = false;

        throw err;
    }
}
</script>
