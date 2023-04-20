<template>
<div class="card">
    <div class="card-body">
        <div class="d-flex">
            <h3 class="card-title">Registered Users</h3>

            <div class='ms-auto'>
                <div class="btn-list">
                    <TablerSelect
                        :default='current'
                        :values='["Last 30 Days", "Month To Date", "Current Quarter", "Year To Date", "All Time"]'
                        @select='current = $event'
                    />

                    <button data-bs-toggle="dropdown" type="button" class="btn dropdown-toggle dropdown-toggle-split" aria-expanded="false"></button>
                    <div class="dropdown-menu dropdown-menu-end" style="">
                        <a @click='getExport' class="dropdown-item" href="#">Export</a>
                    </div>
                </div>
            </div>
        </div>
        <div class="row">
            <ApexChart
                :key='current'
                type='line'
                height='350'
                :options='options'
                :series='series'
            />
        </div>
    </div>
</div>
</template>

<script>
import moment from 'moment';
import VueApexCharts from 'vue3-apexcharts'
import { TablerSelect } from '@tak-ps/vue-tabler';

export default {
    name: 'RegisteredCard',
    data: function() {
        return {
            current: 'Last 30 Days',
            scale: 7,
            series: [{
                name: 'users',
                data: []
            }],
            options: {
                chart: {
                    id: "total-users",
                    zoom: {
                        enabled: false
                    },
                },
                xaxis: {
                    type: "datetime"
                }
            }
        }
    },
    mounted: function() {
        this.fetch();
    },
    watch: {
        current: function() {
            this.fetch();
        }
    },
    methods: {
        fetch: async function() {
            const url = await window.stdurl('/api/total');

            if (this.current === 'Last 30 Days') {
                const dt = moment().subtract(30, 'd');
                url.searchParams.append('after', dt.format('YYYY-MM-DD'));
                this.options.xaxis.min = dt.toDate().getTime();
            } else if (this.current === 'Month To Date') {
                const dt = moment().startOf('month');
                url.searchParams.append('after', dt.format('YYYY-MM-DD'));
                this.options.xaxis.min = dt.toDate().getTime();
            } else if (this.current === "Current Quarter") {
                const dt = moment().quarter(moment().quarter()).startOf('quarter');
                url.searchParams.append('after', dt.format('YYYY-MM-DD'));
                this.options.xaxis.min = dt.toDate().getTime();
            } else if (this.current === 'Year To Date') {
                const dt = moment(moment().format('YYYY') + '-01-01');
                url.searchParams.append('after', dt.format('YYYY-MM-DD'));
                this.options.xaxis.min = dt.toDate().getTime();
            } else {
                delete this.options.xaxis.min;
            }

            const list = await window.std(url);

            this.series[0].data = list.totals.map((total) => {
                return { x: new Date(total.dt), y: total.count };
            });
        },
        getExport: async function() {
            const url = new URL('/api/total/export', window.location.origin);
            // Allow serving through Vue for hotloading
            if (url.hostname === 'localhost') url.port = '4999'
            window.open(url, "_blank")
        }
    },
    components: {
        TablerSelect,
        ApexChart: VueApexCharts
    }
}
</script>
