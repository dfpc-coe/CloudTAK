<template>
    <MenuTemplate name='Videos' :loading='loading'>
        <template #buttons>
            <IconPlus
                v-tooltip='"Get Lease"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='lease={}'
            />
            <IconRefresh
                v-tooltip='"Refresh"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='refresh'
            />
        </template>
        <template #default>
            <div
                v-for='lease in leases.items'
                :key='lease.id'
                class='col-12 py-2 px-3 d-flex align-items-center hover-dark'
            >
                <div class='row g-0'>
                    <div class='col-12 d-flex align-items-center my-0 py-0'>
                        <IconVideo
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            class='mx-2'
                            v-text='lease.name'
                        />
                    </div>
                    <div class='col-12 my-0 py-0'>
                        <span
                            style='margin-left: 42px;'
                            class='subheader'
                            v-text='lease.expiration'
                        />
                    </div>
                </div>
            </div>
            <div class='col-12'>
                <TablerNone
                    v-if='!videos.size'
                    label='Video Streams'
                    :create='false'
                />
                <template v-else>
                    <div
                        v-for='video in videos'
                        :key='video.id'
                        class='col-12 py-2 px-3 d-flex align-items-center hover-dark cursor-pointer'
                        @click='$router.push(`/cot/${video.id}`)'
                    >
                        <IconVideo
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            class='mx-2'
                            style='font-size: 18px;'
                            v-text='video.properties.callsign'
                        />
                    </div>
                </template>
            </div>
        </template>
    </MenuTemplate>

    <VideoLeaseModal
        v-if='lease'
        :lease='lease'
        @close='lease = false'
        @refresh='fetchLeases'
    />

</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import VideoLeaseModal from './Videos/VideoLeaseModal.vue';
import { std } from '/src/std.ts';
import { useCOTStore } from '/src/stores/cots.ts';
import {
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconVideo,
    IconRefresh,
} from '@tabler/icons-vue';

const cotStore = useCOTStore();

export default {
    name: 'CloudTAKVideos',
    components: {
        IconPlus,
        IconVideo,
        IconRefresh,
        MenuTemplate,
        VideoLeaseModal,
        TablerNone
    },
    data: function() {
        return {
            loading: true,
            lease: false,
            leases: {
                total: 0,
                items: []
            },
            videos: cotStore.videos()
        }
    },
    mounted: async function() {
        await this.fetchLeases();
    },
    methods: {
        refresh: async function() {
            await this.fetchLeases();
            this.videos = cotStore.videos();
        },
        fetchLeases: async function() {
            this.lease = false;
            this.loading = true;
            this.leases = await std('/api/video/lease')
            this.loading = false;
        }
    }
}
</script>
