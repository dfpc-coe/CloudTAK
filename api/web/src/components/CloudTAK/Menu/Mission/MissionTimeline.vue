<template>
    <MenuTemplate
        name='Mission Timeline'
        :back='false'
        :border='false'
        :loading='loading'
    >
        <TablerAlert v-if='err' />
        <TablerNone
            v-else-if='!changes.length'
            :create='false'
        />
        <div
            v-else
            class='rows overflow-auto'
            style='height: 50vh;'
        >
            <div
                v-for='change in changes'
                :key='change'
                class='col-12 hover-dark px-2 py-1'
            >
                <template v-if='change.type === "CREATE_MISSION"'>
                    <IconSquarePlus size='24' /><span
                        class='mx-2'
                        v-text='`Mission Created: ${change.missionName}`'
                    />
                </template>
                <template v-else-if='change.type === "ADD_CONTENT" && change.contentResource'>
                    <IconFile size='24' /><span
                        class='mx-2'
                        v-text='change.contentResource.name'
                    />
                </template>
                <template v-else-if='change.type === "ADD_CONTENT" && change.details'>
                    <IconPolygon size='24' /><span
                        class='mx-2'
                        v-text='`${change.details.callsign} (${change.details.type})`'
                    />
                </template>
                <template v-else-if='change.type === "ADD_CONTENT"'>
                    <IconsquarePlus size='24' /><span class='mx-2' v-tooltip='change.contentUid'>Content Added</span>
                </template>
                <template v-else-if='change.type === "REMOVE_CONTENT" && change.contentResource'>
                    <IconFileX size='24' /><span
                        class='mx-2'
                        v-text='change.contentResource.name'
                    />
                </template>
                <template v-else-if='change.type === "REMOVE_CONTENT"'>
                    <IconSquareX size='24' /><span class='mx-2' v-tooltip='change.contentUid'>Content Removed</span>
                </template>
                <template v-else>
                    <span v-text='change' />
                </template>
                <div class='col-12 d-flex'>
                    <label
                        class='subheader'
                        v-text='change.type'
                    />
                    <label
                        class='subheader ms-auto'
                        v-text='change.timestamp'
                    />
                </div>
            </div>
        </div>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconMinus,
    IconSquarePlus,
    IconSquareX,
    IconFileX,
    IconTimeline,
    IconFile,
    IconPolygon,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerNone,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'MissionTimeline',
    props: {
        mission: Object
    },
    components: {
        MenuTemplate,
        TablerNone,
        TablerAlert,
        TablerLoading,
        TablerDelete,
        TablerInput,
        IconSquareX,
        IconSquarePlus,
        IconMinus,
        IconFile,
        IconPolygon,
        IconFileX,
        IconTimeline
    },
    props: {
        mission: Object
    },
    emits: [
        'close',
        'select'
    ],
    data: function() {
        return {
            loading: true,
            changes: [],
        }
    },
    mounted: async function() {
        await this.fetchChanges();
    },
    methods: {
        genConfig: function() {
            return { id: this.mission.name }
        },
        fetchChanges: async function() {
            this.loading = true;
            const url = await stdurl(`/api/marti/missions/${this.mission.name}/changes`);
            this.changes = (await std(url)).data;
            this.loading = false;
        },
    }
}
</script>
