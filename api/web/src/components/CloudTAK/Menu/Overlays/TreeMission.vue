<template>
    <TablerLoading v-if='loading' />
    <template v-else-if='markers().length === 0'>
        <div class='ms-3'>
            <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                <IconInfoCircle
                    size='20'
                    :stroke='1'
                    class='me-1'
                />
                No Markers
            </div>
        </div>
    </template>
    <template v-else>
        <div
            v-for='marker in markers()'
            class='ms-3'
        >
            <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.markers[marker]'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState.markers[marker] = true'
                />
                <IconChevronDown
                    v-else-if='treeState.markers[marker]'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState.markers[marker] = false'
                />
                <IconFolder
                    class='mx-2'
                    :size='20'
                    :stroke='2'
                /> <span v-text='marker' />
            </div>

            <template v-if='treeState.markers[marker]'>
                <div class='ms-3'>
                    <div class='ms-3'>
                        <Feature
                            v-for='cot of markerFeatures(marker)'
                            :key='cot.id'
                            :mission='overlay.mode_id'
                            :feature='cot'
                        />
                    </div>
                </div>
            </template>
        </div>
    </template>
</template>

<script>
import {
    TablerLoading,
} from '@tak-ps/vue-tabler';
import Feature from '../../util/Feature.vue';
import {
    IconChevronRight,
    IconChevronDown,
    IconInfoCircle,
    IconFolder,
} from '@tabler/icons-vue';
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();

export default {
    name: 'TreeCots',
    components: {
        Feature,
        TablerLoading,
        IconInfoCircle,
        IconChevronRight,
        IconChevronDown,
        IconFolder,
    },
    props: {
        overlay: Object
    },
    data: function() {
        return {
            loading: false,
            deleteMarkerModal: {
                shown: false,
                marker: null
            },
            treeState: {
                markers: {
                    _: false
                },
            },
        }
    },
    computed: {
        paths: function() {
            return cotStore.paths();
        },
    },
    methods: {
        markerFeatures: function(marker) {
            return cotStore.markerFeatures(
                cotStore.subscriptions.get(this.overlay.mode_id).cots,
                marker
            );
        },
        markers: function() {
            const markers = cotStore.markers(
                cotStore.subscriptions.get(this.overlay.mode_id).cots
            );

            for (const marker of markers) {
                if (this.treeState.markers[marker] === undefined) {
                    this.treeState.markers[marker] = false;
                }
            }

            return markers;
        },
    },
}
</script>
