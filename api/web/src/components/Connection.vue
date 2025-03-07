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
                        <div class='card'>
                            <TablerLoading
                                v-if='!connection'
                                class='text-white'
                            />
                            <template v-else>
                                <div class='card-header'>
                                    <ConnectionStatus :connection='connection' />

                                    <a
                                        class='card-title cursor-pointer mx-2'
                                        @click='router.push(`/connection/${connection.id}`)'
                                        v-text='connection.name'
                                    />

                                    <div class='ms-auto d-flex align-items-center btn-list'>
                                        <AgencyBadge :connection='connection' />

                                        <TablerIconButton
                                            title='Cycle Connection'
                                            @click='refresh'
                                        >
                                            <IconPlugConnected
                                                :size='32'
                                                stroke='1'
                                            />
                                        </TablerIconButton>
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
                                            @click='router.push(`/connection/${connection.id}/edit`)'
                                        >
                                            <IconSettings
                                                :size='32'
                                                stroke='1'
                                            />
                                        </TablerIconButton>
                                    </div>
                                </div>
                                <div class='card-body'>
                                    <div class='row g-2'>
                                        <div class='col-12'>
                                            <TablerMarkdown :markdown='connection.description' />
                                        </div>
                                        <div class='col-12 datagrid'>
                                            <div class='datagrid-item pb-2'>
                                                <div class='datagrid-title'>
                                                    Certificate Valid From
                                                </div>
                                                <div
                                                    class='datagrid-content'
                                                    v-text='connection.certificate.validFrom'
                                                />
                                            </div>
                                            <div class='datagrid-item pb-2'>
                                                <div class='datagrid-title'>
                                                    Certificate Valid To
                                                </div>
                                                <div
                                                    class='datagrid-content'
                                                    v-text='connection.certificate.validTo'
                                                />
                                            </div>
                                            <div class='datagrid-item pb-2'>
                                                <div class='datagrid-title'>
                                                    Certificate Subject
                                                </div>
                                                <div
                                                    class='datagrid-content'
                                                    v-text='connection.certificate.subject'
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class='card-footer'>
                                    Last updated <span v-text='timeDiff(connection.updated)' />
                                </div>
                            </template>
                        </div>
                    </div>

                    <div
                        v-if='connection'
                        class='col-lg-12'
                    >
                        <div class='card'>
                            <div class='row g-0'>
                                <div class='col-12 col-md-3 border-end'>
                                    <div class='card-body'>
                                        <h4 class='subheader'>
                                            Connection Sections
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
                                                    "active": route.name === "connection-layers",
                                                    "cursor-pointer": route.name !== "connection-layers"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/layer`)'
                                            ><IconBuildingBroadcastTower
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Layers</span></span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "connection-groups",
                                                    "cursor-pointer": route.name !== "connection-groups"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/groups`)'
                                            ><IconAffiliate
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Channels</span></span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "connection-files",
                                                    "cursor-pointer": route.name !== "connection-files"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/files`)'
                                            ><IconFiles
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Files</span></span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "connection-datas",
                                                    "cursor-pointer": route.name !== "connection-datas"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/data`)'
                                            ><IconDatabase
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Data Syncs</span></span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "connection-sinks",
                                                    "cursor-pointer": route.name !== "connection-sinks"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/sink`)'
                                            ><IconOutbound
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Outbounds Sinks</span></span>
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "connection-tokens",
                                                    "cursor-pointer": route.name !== "connection-tokens"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/tokens`)'
                                            ><IconRobot
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>API Tokens</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9 position-relative'>
                                    <router-view
                                        :connection='connection'
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
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ETLConnection } from '../types.ts';
import { std } from '../std.ts';
import PageFooter from './PageFooter.vue';
import ConnectionStatus from './Connection/Status.vue';
import timeDiff from '../timediff.ts';
import {
    IconFiles,
    IconRobot,
    IconRefresh,
    IconDatabase,
    IconOutbound,
    IconAffiliate,
    IconPlugConnected,
    IconBuildingBroadcastTower,
    IconSettings
} from '@tabler/icons-vue'
import {
    TablerIconButton,
    TablerBreadCrumb,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import AgencyBadge from './Connection/AgencyBadge.vue';

const route = useRoute();
const router = useRouter();

const connection = ref<ETLConnection | undefined>();

onMounted(async () => {
    await fetch();
});

async function fetch() {
    connection.value = await std(`/api/connection/${route.params.connectionid}`) as ETLConnection;
}

async function refresh() {
    connection.value = await std(`/api/connection/${route.params.connectionid}/refresh`, {
        method: 'POST'
    }) as ETLConnection;
}
</script>
