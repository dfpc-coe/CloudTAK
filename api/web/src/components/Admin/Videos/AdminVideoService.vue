<template>
    <div class='card-header'>
        <div class='card-title'>
            Video Service
        </div>
        <div class='ms-auto btn-list'>
            <TablerIconButton
                title='Edit Service'
                @click='disabled = false'
            >
                <IconPencil
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                title='Refresh'
                @click='fetchService'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </div>
    </div>
    <div class='card-body'>
        <TablerLoading v-if='loading' />
        <TablerNone
            v-else-if='!service'
            label='Video ECS Service'
            :create='false'
        />
        <VideoConfig
            v-else
            :service='service'
            :disabled='disabled'
            @cancel='disabled = true'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { VideoService } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import VideoConfig from './VideoConfig.vue';
import {
    IconPencil,
    IconRefresh
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerIconButton,
    TablerLoading
} from '@tak-ps/vue-tabler';

const disabled = ref(true);
const loading = ref(true);

const service = ref<VideoService | undefined>();

onMounted(async () => {
    loading.value = true;
    await fetchService()
    loading.value = false;
});

async function fetchService() {
    loading.value = true;
    const url = stdurl('/api/video/service');
    service.value = await std(url) as VideoService;
    loading.value = false;
}
</script>
