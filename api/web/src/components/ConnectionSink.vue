<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <TablerLoading v-if='!sink' />
                        <div
                            v-else
                            class='card'
                        >
                            <div class='card-header'>
                                <h1
                                    class='card-title'
                                    v-text='sink.name'
                                />

                                <div class='ms-auto btn-list'>
                                    <div class='d-flex'>
                                        <span class='px-2'>Logging</span>
                                        <label class='form-check form-switch'>
                                            <input
                                                v-model='sink.logging'
                                                disabled
                                                class='form-check-input'
                                                type='checkbox'
                                            >
                                        </label>
                                    </div>
                                    <div class='d-flex'>
                                        <span class='px-2'>Enabled</span>
                                        <label class='form-check form-switch'>
                                            <input
                                                v-model='sink.enabled'
                                                disabled
                                                class='form-check-input'
                                                type='checkbox'
                                            >
                                        </label>
                                    </div>
                                    <TablerIconButton
                                        title='Refresh'
                                        @click='fetch'
                                    >
                                        <IconRefresh
                                            :size='32'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                    <TablerIconButton
                                        title='Edit'
                                        @click='router.push(`/connection/${route.params.connectionid}/sink/${route.params.sinkid}/edit`)'
                                    >
                                        <IconPencil
                                            :size='32'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </div>
                            </div>
                            <div class='card-body'>
                                <div class='d-flex justify-content-center pb-4'>
                                    <div class='btn-list'>
                                        <div
                                            class='btn-group'
                                            role='group'
                                        >
                                            <input
                                                v-model='mode'
                                                type='radio'
                                                class='btn-check'
                                                name='geom-toolbar'
                                                value='points'
                                            >
                                            <label
                                                class='btn btn-icon px-3'
                                                @click='mode="points"'
                                            >
                                                <IconPoint
                                                    :size='32'
                                                    stroke='1'
                                                /> Points
                                            </label>
                                            <input
                                                v-model='mode'
                                                type='radio'
                                                class='btn-check'
                                                name='geom-toolbar'
                                                value='lines'
                                            >
                                            <label
                                                class='btn btn-icon px-3'
                                                @click='mode="lines"'
                                            >
                                                <IconLine
                                                    :size='32'
                                                    stroke='1'
                                                /> Lines
                                            </label>
                                            <input
                                                v-model='mode'
                                                type='radio'
                                                class='btn-check'
                                                name='geom-toolbar'
                                                value='polys'
                                            >
                                            <label
                                                class='btn btn-icon px-3'
                                                @click='mode="polys"'
                                            >
                                                <IconPolygon
                                                    :size='32'
                                                    stroke='1'
                                                /> Polygons
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <TablerNone
                                    v-if='!sink.body[mode]'
                                    :create='false'
                                    label='Layer Configured'
                                />
                                <EsriPortal
                                    v-else
                                    :key='mode'
                                    :disabled='true'
                                    :pane='false'
                                    :url='sink.body.url'
                                    :sinkid='parseInt(String(route.params.sinkid))'
                                    :layer='sink.body[mode]'
                                />
                            </div>
                            <div class='card-footer'>
                                Last updated <span v-text='timeDiff(sink.updated)' />
                            </div>
                        </div>
                    </div>
                    <div class='col-lg-12'>
                        <ConnectionSinkChart v-if='sink && sink.logging' />
                        <div
                            v-else
                            class='card'
                        >
                            <div class='card-header'>
                                <h1 class='card-title'>
                                    Sink Logging
                                </h1>
                            </div>
                            <div class='card-body'>
                                <TablerAlert
                                    title='Logging Disabled'
                                    err='new Error("Turn on Sink Logging to get CoT Delivery Logs")'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <PageFooter />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ETLConnectionSink } from '../types.ts';
import { std } from '../std.ts';
import PageFooter from './PageFooter.vue';
import timeDiff from '../timediff.ts';
import {
    IconPoint,
    IconLine,
    IconPolygon,
    IconRefresh,
    IconPencil
} from '@tabler/icons-vue'
import EsriPortal from './util/EsriPortal.vue';
import ConnectionSinkChart from './ConnectionSink/Chart.vue';
import {
    TablerNone,
    TablerAlert,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';

const mode = ref('points');
const sink = ref<ETLConnectionSink | undefined>();

const route = useRoute();
const router = useRouter();

onMounted(async () => {
    await fetch();
});

async function fetch() {
    sink.value = await std(`/api/connection/${route.params.connectionid}/sink/${route.params.sinkid}`) as ETLConnectionSink
}
</script>
