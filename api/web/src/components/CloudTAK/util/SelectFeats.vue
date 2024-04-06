<template>
<div class='col-12 container' style='max-height: 400px;'>
    <template v-if='!share'>
        <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
            <div class='subheader mx-2 my-2'>Selected Features</div>
            <div class='ms-auto'><IconX @click='selected.clear()' class='cursor-pointer mx-2 my-2' size='20' v-tooltip='"Clear Selection"'/></div>
        </div>
        <div
            class='overflow-auto'
            style='
                max-height: calc(400px - 36px - 36px);
                margin-bottom: 36px;
            '
        >
            <div v-for='select in selected.values()' class='col-12 d-flex hover-dark'>
                <span class='mx-2 my-2 user-select-none' v-text='select.properties.callsign'/>
                <IconTrash @click='selected.delete(select.properties.id)' size='20' class='ms-auto cursor-pointer mx-2 my-2' v-tooltip='"Remove from Selection"'/>
            </div>
        </div>
        <div style='height: 36px;' class='position-absolute bottom-0 start-0 end-0 px-2 bg-dark'>
            <button
                @click='share = true'
                class='w-100 btn'
                style='height: 30px'
            >
                <IconPackageExport size='20'/>
                <span class='mx-2'>Share</span>
            </button>
        </div>
    </template>
    <template v-else>
        <Share
            feats='selected.values()'
            @done='selected.clear()'
            @cancel='share = false'
            maxheight='400px'
            :compact='true'
        />
    </template>
</div>
</template>

<script>
import {
    IconPackageExport,
    IconTrash,
    IconX,
} from '@tabler/icons-vue';
import Share from './Share.vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'SelectFeats',
    props: {
        selected: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            share: false
        }
    },
    components: {
        Share,
        IconTrash,
        IconPackageExport,
        IconX,
    }
}
</script>
