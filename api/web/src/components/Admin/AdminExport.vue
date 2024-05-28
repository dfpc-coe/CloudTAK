<template>
<div>
    <div class='card-header'>
        <h3 class='card-title'>
            Data Export
        </h3>
    </div>
    <TablerLoading v-if='loading'/>
    <div v-else class='card-body row g-2'>
        <div class='col-6'>
            <TablerInput label='Start Time' v-model='data.startTime' type='datetime-local'/>
        </div>
        <div class='col-6'>
            <TablerInput label='End Time' v-model='data.endTime' type='datetime-local'/>
        </div>
        <div class='col-12'>
            <TablerEnum label='Export Format' v-model='data.format' :options='["kmz", "kml"]'/>
        </div>
        <div class='col-12'>
            <TablerToggle label='Extended Data (Disabled)' disabled v-model='data.extendedData'/>
        </div>
        <div class='col-12'>
            <TablerToggle label='Optimize Export' v-model='data.optimizeExport'/>
        </div>
        <div class='col-12 d-flex py-2'>
            <div class='ms-auto'>
                <button @click='postExport' class='btn btn-primary'>Export</button>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerLoading,
    TablerToggle,
    TablerEnum,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'AdminExport',
    components: {
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
                optimizeExport: true
            }
        }
    },
    methods: {
        postExport: async function() {
            this.loading = true;
            try {
                await std(`/api/marti/export`, {
                    method: 'POST',
                    body: this.data
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
