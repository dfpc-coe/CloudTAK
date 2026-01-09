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

        <TablerLoading
            v-if='!data || !connection'
            class='text-white'
            desc='Loading Data'
        />
        <div
            v-else
            class='page-body'
        >
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='card-header'>
                                <ConnectionStatus :connection='connection' />

                                <a
                                    class='card-title cursor-pointer mx-2'
                                    @click='router.push(`/connection/${connection.id}`)'
                                    v-text='connection.name'
                                />

                                <span class='mx-1'>-</span>

                                <div
                                    class='card-title mx-1'
                                    v-text='data.name'
                                />

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <IconAccessPoint
                                            v-if='data.mission_sync'
                                            v-tooltip='"Mission Sync On"'
                                            :size='32'
                                            stroke='1'
                                            class='text-green'
                                        />
                                        <IconAccessPointOff
                                            v-else
                                            v-tooltip='"Mission Sync Off"'
                                            :size='32'
                                            stroke='1'
                                            class='text-red'
                                        />

                                        <TablerIconButton
                                            title='Edit'
                                            @click='router.push(`/connection/${route.params.connectionid}/data/${data.id}/edit`)'
                                        >
                                            <IconSettings
                                                :size='32'
                                                stroke='1'
                                            />
                                        </TablerIconButton>
                                    </div>
                                </div>
                            </div>
                            <TablerMarkdown
                                class='card-body'
                                :markdown='data.description'
                            />

                            <div
                                v-if='mission_error'
                                class='card-body bg-red-lt'
                            >
                                <div class='header'>
                                    TAK Server Sync Error
                                </div>

                                <div class='datagrid'>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>
                                            Status
                                        </div>
                                        <div
                                            class='datagrid-content'
                                            v-text='mission_error.status'
                                        />
                                    </div>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>
                                            Code
                                        </div>
                                        <div
                                            class='datagrid-content'
                                            v-text='mission_error.code'
                                        />
                                    </div>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>
                                            Message
                                        </div>
                                        <div
                                            class='datagrid-content'
                                            v-text='mission_error.message'
                                        />
                                    </div>
                                </div>
                            </div>

                            <div class='card-footer d-flex align-items-center'>
                                <div>
                                    Last updated <span v-text='timeDiff(data.updated)' />
                                </div>
                                <div class='ms-auto'> 
                                    <InitialAuthor :email='data.username || "Unknown"' />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='row g-0'>
                                <div class='col-12 col-md-3 border-end'>
                                    <div class='card-body'>
                                        <h4 class='subheader'>
                                            Data Sections
                                        </h4>
                                        <div
                                            role='menu'
                                            class='list-group list-group-transparent'
                                        >
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "data-groups",
                                                    "cursor-pointer": route.name !== "data-groups"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/data/${route.params.dataid}/groups`)'
                                            ><IconAffiliate
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Channels</span></span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "data-files",
                                                    "cursor-pointer": route.name !== "data-files"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/data/${route.params.dataid}/files`)'
                                            ><IconFiles
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Files</span></span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "data-layer",
                                                    "cursor-pointer": route.name !== "data-layer"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/data/${route.params.dataid}/layer`)'
                                            ><IconBuildingBroadcastTower
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Layers</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9 position-relative'>
                                    <router-view
                                        :data='data'
                                    />
                                </div>
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
import type { ETLData, ETLConnection } from '../../types.ts';
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std } from '../../std.ts';
import PageFooter from '../PageFooter.vue';
import timeDiff from '../../timediff.ts';
import InitialAuthor from '../util/InitialAuthor.vue';
import {
    TablerLoading,
    TablerIconButton,
    TablerMarkdown,
    TablerBreadCrumb,
} from '@tak-ps/vue-tabler'
import {
    IconFiles,
    IconAffiliate,
    IconBuildingBroadcastTower,
    IconSettings,
    IconAccessPoint,
    IconAccessPointOff,
} from '@tabler/icons-vue'
import ConnectionStatus from './Connection/StatusDot.vue';

const route = useRoute();
const router = useRouter();

const connection = ref<ETLConnection | undefined >();
const data = ref<ETLData | undefined>();

const mission_error = computed<{
    code: string
    status: string;
    message: string
} | undefined>(() => {
    if (!data.value || !data.value.mission_error) return;

    try {
        return JSON.parse(data.value.mission_error)
    } catch (err) {
        console.error(err)
        return {
            code: 'Unknown',
            status: 'Unknown',
            message: data.value.mission_error
        }
    }
});

onMounted(async () => {
    await fetchConnection();
    await fetch();
});


async function fetchConnection() {
    connection.value = await std(`/api/connection/${route.params.connectionid}`) as ETLConnection;
}

async function fetch() {
    data.value = await std(`/api/connection/${route.params.connectionid}/data/${route.params.dataid}`) as ETLData;
}
</script>
