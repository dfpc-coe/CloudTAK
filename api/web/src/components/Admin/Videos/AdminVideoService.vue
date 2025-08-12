<template>
    <div class='card-header'>
        <div class='card-title'>
            Video Service
        </div>
        <div class='ms-auto btn-list'>
            <TablerRefreshButton
                title='Refresh'
                :loading='loading'
                @click='fetchService'
            />
        </div>
    </div>
    <div class='card-body'>
        <TablerLoading v-if='loading' />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <TablerNone
            v-else-if='!service'
            label='Video ECS Service'
            :create='false'
        />
        <VideoConfig
            v-else
            :service='service'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { VideoService } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import VideoConfig from './VideoConfig.vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';

const error = ref<Error | undefined>();
const loading = ref(true);

const service = ref<VideoService | undefined>();

onMounted(async () => {
    loading.value = true;
    await fetchService()
    loading.value = false;
});

async function fetchService() {
    loading.value = true;

    try {
        const url = stdurl('/api/video/service');
        service.value = await std(url) as VideoService;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>
