<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Connection Events
            </h3>

            <div class='ms-auto'>
                <div class='btn-list'>
                    <IconTrash
                        v-tooltip='"Clear Events"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='events = []'
                    />

                    <IconPlayerPlay
                        v-if='paused'
                        v-tooltip='"Play Events"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='paused = false'
                    />
                    <IconPlayerPause
                        v-else
                        v-tooltip='"Pause Events"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='paused = true'
                    />
                </div>
            </div>
        </div>
        <pre v-text='eventStr' />
    </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { stdurl } from '/src/std.ts';
import {
    IconTrash,
    IconPlayerPlay,
    IconPlayerPause
} from '@tabler/icons-vue';

const emit = defineEmits(['err']);

const route = useRoute();

const ws = ref(null);
const paused = ref(false);
const events = ref([]);

const eventStr = computed(() => {
    return events.value.join('\n');
});

onUnmounted(() => {
    if (ws.value) ws.value.close();
});

onMounted(() => {
    const url = stdurl('/api');
    url.searchParams.append('connection', route.params.connectionid);
    url.searchParams.append('token', localStorage.token);
    if (window.location.hostname === 'localhost') {
        url.protocol = 'ws:';
    } else {
        url.protocol = 'wss:';
    }

    ws.value = new WebSocket(url);
    ws.value.addEventListener('error', (err) => { emit('err', err) });

    ws.value.addEventListener('message', (msg) => {
        msg = JSON.parse(msg.data);
        if (paused.value) return;
        if (msg.type !== 'cot' || msg.connection !== parseInt(route.params.connectionid)) return;

        if (events.value.length > 200) events.value.pop();
        events.value.unshift(JSON.stringify(msg.data));
    });
});
</script>
