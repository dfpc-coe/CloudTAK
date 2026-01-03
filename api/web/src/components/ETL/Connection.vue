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
                                <ConnectionCard
                                    :connection='connection'
                                    :clickable='false'
                                    :expanded='true'
                                    @update:connection='connection = $event'
                                />
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
                                                v-if='!connection.readonly'
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
                                                v-if='!connection.readonly'
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
                                                v-if='!connection.readonly'
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
                                                v-if='!connection.readonly'
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "connection-videos",
                                                    "cursor-pointer": route.name !== "connection-videos"
                                                }'
                                                @click='router.push(`/connection/${route.params.connectionid}/video`)'
                                            ><IconVideo
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Videos</span></span>
                                            <span
                                                v-if='!connection.readonly'
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
import type { ETLConnection } from '../../types.ts';
import { std } from '../../std.ts';
import PageFooter from '../PageFooter.vue';
import ConnectionCard from './ConnectionCard.vue';
import {
    IconFiles,
    IconRobot,
    IconVideo,
    IconDatabase,
    IconAffiliate,
    IconBuildingBroadcastTower,
} from '@tabler/icons-vue'
import {
    TablerBreadCrumb,
    TablerLoading,
} from '@tak-ps/vue-tabler';

const route = useRoute();
const router = useRouter();

const connection = ref<ETLConnection | undefined>();

onMounted(async () => {
    if (route.params.connectionid === 'template') {
        router.push('/connection');
        return;
    }

    await fetch();

    if (connection.value && connection.value.readonly) {
        router.push(`/connection/${connection.value.id}/groups`);
    }
});

async function fetch() {
    connection.value = undefined;
    connection.value = await std(`/api/connection/${route.params.connectionid}`) as ETLConnection;
}
</script>
