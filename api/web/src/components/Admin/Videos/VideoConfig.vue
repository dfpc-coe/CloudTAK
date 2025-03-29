<template>
    <div class='col-12 py-2 g-2'>
        <TablerLoading v-if='loading' />
        <div
            v-else
            class='row g-0 px-2'
        >
            <div class='col-12'>
                <TablerToggle
                    v-model='config.api'
                    :disabled='disabled'
                    class='subheader'
                    label='Config API Enabled'
                />
                <div
                    v-if='config.api'
                    id='api-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.apiAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.metrics'
                    :disabled='disabled'
                    class='subheader'
                    label='Metrics API Enabled'
                />
                <div
                    v-if='config.metrics'
                    id='metrics-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.metricsAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.pprof'
                    :disabled='disabled'
                    class='subheader'
                    label='Performance API Enabled'
                />
                <div
                    v-if='config.pprof'
                    id='pprof-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.pprofAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.playback'
                    :disabled='disabled'
                    class='subheader'
                    label='Playback API Enabled'
                />
                <div
                    v-if='config.playback'
                    id='playback-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.playbackAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.rtsp'
                    :disabled='disabled'
                    class='subheader'
                    label='RTSP API Enabled'
                />
                <div
                    v-if='config.rtsp'
                    id='rtsp-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.rtspAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.rtmp'
                    :disabled='disabled'
                    class='subheader'
                    label='RTMP API Enabled'
                />
                <div
                    v-if='config.rtmp'
                    id='rtmp-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.rtmpAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.hls'
                    :disabled='disabled'
                    class='subheader'
                    label='HLS API Enabled'
                />
                <div
                    v-if='config.hls'
                    id='hls-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.hlsAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.webrtc'
                    :disabled='disabled'
                    class='subheader'
                    label='WebRTC API Enabled'
                />
                <div
                    v-if='config.webrtc'
                    id='webrtc-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.webrtcAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.srt'
                    :disabled='disabled'
                    class='subheader'
                    label='SRT API Enabled'
                />
                <div
                    v-if='config.srt'
                    id='srt-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.srtAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>
        </div>

        <div
            v-if='!disabled'
            class='col-12 d-flex px-2 py-3'
        >
            <button
                class='btn btn-secondary'
                @click='$emit("cancel")'
            >
                Cancel
            </button>

            <div class='ms-auto'>
                <button
                    class='btn btn-primary'
                    @click='saveConfig'
                >
                    Submit
                </button>
            </div>
        </div>

        <template v-if='disabled'>
            <div class='row g-0 py-3'>
                <label class='subheader mx-2'>Server Paths</label>
                <div class='col-12 border rounded mx-2'>
                    <TablerNone
                        v-if='(service.paths || []).length === 0'
                        :create='false'
                        :compact='true'
                        label='Server Paths'
                    />
                    <template v-else>
                        <div
                            v-for='path in service.paths'
                            class='hover-light px-2 py-2 cursor-pointer d-flex align-items-center'
                            @click='pathid = path.name'
                        >
                            <StatusDot
                                :title='path.ready ? "Streaming" : "Not Streaming"'
                                :status='path.ready ? "success" : "fail"'
                            />
                            <span
                                class='mx-2'
                                v-text='path.name'
                            />

                            <div class='ms-auto'>
                                <IconUsersGroup
                                    :size='32'
                                    stroke='1'
                                />
                                <span
                                    class='mx-2'
                                    v-text='`${path.readers.length} Viewers`'
                                />
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </template>
    </div>

    <VideoConfigPath
        v-if='pathid'
        :pathid='pathid'
        @close='pathid = undefined'
    />
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { std } from '../../../std.ts';
import type { VideoService } from '../../../types.ts';
import VideoConfigPath from './VideoConfigPath.vue';
import StatusDot from '../../util/StatusDot.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerToggle
} from '@tak-ps/vue-tabler';
import {
    IconUsersGroup
} from '@tabler/icons-vue'

const props = withDefaults(defineProps<{
    service: VideoService,
    disabled: boolean
}>(), {
    disabled: true
})

const emit = defineEmits([ 'cancel' ]);

const loading = ref(false);
const pathid = ref<string | undefined>();
const config = ref(JSON.parse(JSON.stringify(props.service.config)))

async function saveConfig() {
    loading.value = true;

    await std('/api/video/service', {
        method: 'PATCH',
        body: config.value
    });

    loading.value = false;
    emit('cancel');
}
</script>
