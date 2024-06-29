<template>
    <div
        class='col-12'
        style='max-height: 400px'
    >
        <template v-if='!share'>
            <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
                <div class='subheader mx-2 my-2'>
                    Selected Features
                </div>
                <div class='ms-auto'>
                    <IconX
                        v-tooltip='"Clear Selection"'
                        class='cursor-pointer mx-2 my-2'
                        :size='20'
                        :stroke='1'
                        @click='selected.clear()'
                    />
                </div>
            </div>
            <div
                class='overflow-auto'
                style='
                max-height: calc(400px - 36px);
                margin-bottom: 36px;
            '
            >
                <div
                    v-for='select in selected.values()'
                    class='col-12 d-flex hover-dark'
                >
                    <span
                        class='mx-2 my-2 user-select-none'
                        v-text='select.properties.callsign'
                    />
                    <IconTrash
                        v-tooltip='"Remove from Selection"'
                        :size='20'
                        :stroke='1'
                        class='ms-auto cursor-pointer mx-2 my-2'
                        @click='selected.delete(select.properties.id)'
                    />
                </div>
            </div>
            <div
                style='height: 36px;'
                class='position-absolute bottom-0 start-0 end-0 px-2 bg-dark'
            >
                <button
                    class='w-100 btn'
                    style='height: 30px'
                    @click='share = true'
                >
                    <IconPackageExport
                        :size='20'
                        :stroke='1'
                     />
                    <span class='mx-2'>Share</span>
                </button>
            </div>
        </template>
        <template v-else>
            <Share
                style='height: 400px;'
                :feats='Array.from(selected.values())'
                :compact='true'
                @done='selected.clear()'
                @cancel='share = false'
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

export default {
    name: 'SelectFeats',
    components: {
        Share,
        IconTrash,
        IconPackageExport,
        IconX,
    },
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
    }
}
</script>
