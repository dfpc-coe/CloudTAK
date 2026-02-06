<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Data Export
            </h3>
        </div>
        <TablerLoading v-if='loading' />
        <div
            v-else
            class='card-body row g-2'
        >
            <div class='col-6'>
                <TablerInput
                    v-model='data.startTime'
                    label='Start Time'
                    type='datetime-local'
                />
            </div>
            <div class='col-6'>
                <TablerInput
                    v-model='data.endTime'
                    label='End Time'
                    type='datetime-local'
                />
            </div>
            <GroupSelect v-model='data.groups' />
            <div class='col-12'>
                <TablerEnum
                    v-model='data.format'
                    label='Export Format'
                    :options='["kmz", "kml"]'
                />
            </div>
            <div class='col-12'>
                <TablerToggle
                    v-model='data.extendedData'
                    label='Extended Data (Disabled)'
                    disabled
                />
            </div>
            <div class='col-12'>
                <TablerToggle
                    v-model='data.optimizeExport'
                    label='Optimize Export'
                />
            </div>
            <div class='col-12 d-flex py-2'>
                <div class='ms-auto'>
                    <button
                        class='btn btn-primary'
                        @click='postExport'
                    >
                        Export
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import GroupSelect from '../util/GroupSelect.vue';
import {
    TablerLoading,
    TablerToggle,
    TablerEnum,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'AdminExport',
    components: {
        GroupSelect,
        TablerLoading,
        TablerToggle,
        TablerEnum,
        TablerInput,
    },
    data: function() {
        let today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        return {
            loading: false,
            data: {
                startTime: today.toISOString().slice(0, -1).replace(/\.\d+$/, ''),
                endTime: today.toISOString().slice(0, -1).replace(/\.\d+$/, ''),
                groups: [],
                format: 'kmz',
                optimizeExport: true,
                extendedData: false
            }
        }
    },
    methods: {
        postExport: async function() {
            this.loading = true;
            try {
                const url = stdurl('/api/marti/export');
                url.searchParams.set('download', 'true');
                await std(url, {
                    method: 'POST',
                    download: `export.${this.data.format}`,
                    body: {
                        ...this.data,
                        startTime: (new Date(this.data.startTime)).toISOString(),
                        endTime: (new Date(this.data.endTime)).toISOString(),
                    }
                });

                this.loading = false;
            } catch (err) {
                this.loading = false;
                throw err;
            }

        }
    }
}
</script>
