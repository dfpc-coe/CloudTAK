<template>
    <MenuTemplate name='Videos'>
        <template #buttons>
            <IconRefresh
                v-tooltip='"Refresh"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='refresh'
            />
        </template>
        <template #default>
            <TablerNone
                v-if='!videos.size'
                label='Videos'
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
        </template>
    </MenuTemplate>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import { useCOTStore } from '/src/stores/cots.ts';
import {
    TablerNone
} from '@tak-ps/vue-tabler';
import {
    IconVideo,
    IconRefresh,
} from '@tabler/icons-vue';

const cotStore = useCOTStore();

export default {
    name: 'CloudTAKSettings',
    components: {
        IconVideo,
        IconRefresh,
        MenuTemplate,
        TablerNone
    },
    data: function() {
        return {
            videos: cotStore.videos()
        }
    },
    methods: {
        refresh: function() {
            this.videos = cotStore.videos();
        }
    }
}
</script>
