<template>
    <div class='card'>
        <div class='card-header'>
            <h1 class='card-title'>
                Sink Logging
            </h1>

            <div class='ms-auto btn-list'>
                <IconRefresh
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='fetchData'
                />
            </div>
        </div>
        <div class='card-body'>
            <TablerLoading v-if='loading' />
            <div
                v-else
                id='chart'
                class='chart-lg'
            />
        </div>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import ApexCharts from 'apexcharts';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh
} from '@tabler/icons-vue';

export default {
    name: 'ConnectionSinkChart',
    components: {
        IconRefresh,
        TablerLoading
    },
    data: function() {
        return {
            loading: true,
            success: [],
            failure: [],
            labels: []
        }
    },
    mounted: async function() {
        await this.fetchData();
    },
    methods: {
        mountChart: function() {
            this.$nextTick(() => {
                new ApexCharts(document.getElementById('chart'), {
                    chart: {
                        type: "line",
                        fontFamily: 'inherit',
                        height: 240,
                        parentHeightOffset: 0,
                        toolbar: {
                            show: false,
                        },
                        animations: {
                            enabled: false
                        },
                    },
                    fill: {
                        opacity: 1,
                    },
                    stroke: {
                        width: 2,
                        lineCap: "round",
                        curve: "smooth",
                    },
                    series: [{
                        name: "Success",
                        data: this.success
                    },{
                        name: "Failure",
                        data: this.failure
                    }],
                    tooltip: { theme: 'dark' },
                    colors: [
                        '#008000',
                        '#FF0000'
                    ],
                    legend: {
                        show: false
                    },
                    xaxis: {
                        labels: {
                            padding: 0,
                        },
                        tooltip: {
                            enabled: false
                        },
                        type: 'datetime',
                    },
                    yaxis: {
                        labels: {
                            padding: 4
                        },
                    },
                    labels: this.labels
                }).render();
            });
        },
        fetchData: async function() {
            this.loading = true;
            const list = await std(`/api/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}/stats`);

            this.labels = list.stats.map(s => s.label);
            this.success = list.stats.map(s => s.success);
            this.failure = list.stats.map(s => s.failure);

            this.loading = false;

            this.mountChart();
        }
    }
}
</script>
