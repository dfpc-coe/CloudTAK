<template>
<div class='card'>
    <div class='card-header'>
        <h2 class='card-title'>Connection Throughput</h2>

        <div class='ms-auto btn-list'>
            <RefreshIcon @click='fetchData' class='cursor-pointer'/>
        </div>
    </div>
    <div class='card-body'>
        <TablerLoading v-if='loading'/>
        <div v-else id="chart" class="chart-lg"></div>
    </div>
</div>
</template>

<script>
import ApexCharts from 'apexcharts';
import {
    RefreshIcon
} from 'vue-tabler-icons'
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionChart',
    data: function() {
        return {
            loading: true,
            success: [],
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
            const list = await window.std(`/api/connection/${this.$route.params.connectionid}/stats`);

            this.labels = list.stats.map(s => s.label);
            this.success = list.stats.map(s => s.success);

            this.loading = false;
            this.mountChart();
        }
    },
    components: {
        RefreshIcon,
        TablerLoading
    }
}
</script>
