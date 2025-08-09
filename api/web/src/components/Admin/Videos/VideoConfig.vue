<template>
    <div class='col-12 py-2 g-2'>
        <TablerLoading v-if='loading' />
        <template v-else>
            <div class='row pb-3 g-3 d-flex align-items-center justify-content-center'>
                <VideoConfigPort
                    name='API'
                    :enabled='config.api'
                    :port='config.apiAddress'
                />

                <VideoConfigPort
                    name='Metrics'
                    :enabled='config.metrics'
                    :port='config.metricsAddress'
                />

                <VideoConfigPort
                    name='Perf'
                    :enabled='config.pprof'
                    :port='config.pprofAddress'
                />

                <VideoConfigPort
                    name='Playback'
                    :enabled='config.playback'
                    :port='config.playbackAddress'
                />
            </div>

            <div class='row g-3 d-flex align-items-center justify-content-center'>
                <VideoConfigPort
                    name='RTMP'
                    :enabled='config.rtmp'
                    :port='config.rtmpAddress'
                />

                <VideoConfigPort
                    name='RTSP'
                    :enabled='config.rtsp'
                    :port='config.rtspAddress'
                />

                <VideoConfigPort
                    name='HLS'
                    :enabled='config.hls'
                    :port='config.hlsAddress'
                />

                <VideoConfigPort
                    name='WebRTC'
                    :enabled='config.webrtc'
                    :port='config.webrtcAddress'
                />

                <VideoConfigPort
                    name='SRT'
                    :enabled='config.srt'
                    :port='config.srtAddress'
                />
            </div>
        </template>

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
                        class='hover px-2 py-2 cursor-pointer d-flex align-items-center'
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
    </div>

    <VideoConfigPath
        v-if='pathid'
        :pathid='pathid'
        @close='pathid = undefined'
    />
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import type { VideoService } from '../../../types.ts';
import VideoConfigPath from './VideoConfigPath.vue';
import VideoConfigPort from './VideoConfigPort.vue';
import StatusDot from '../../util/StatusDot.vue';
import {
    TablerNone,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconUsersGroup
} from '@tabler/icons-vue'

const props = defineProps<{
    service: VideoService,
}>()

const loading = ref(false);
const pathid = ref<string | undefined>();
const config = ref(JSON.parse(JSON.stringify(props.service.config)))
</script>
