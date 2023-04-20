<template>
<div class="card">
    <div class="card-body">
        <div class="d-flex">
            <h3 class="card-title">Top User Groups</h3>

            <div class='ms-auto'>
                <div class="btn-list">
                    <TablerSelect
                        class='mt-1'
                        :default='current'
                        :values='["Category", "Agency", "SubAgency", "Title", "ZipCode"]'
                        @select='fetch($event)'
                    />

                    <div class="btn-group" role="group">
                        <input type="radio" id='top-stats-list' v-model='mode' value='list' class="btn-check"/>
                        <label for='top-stats-list' class="btn btn-sm btn-icon">
                            <ListIcon width='16'/>
                        </label>
                        <input type="radio" id='top-stats-pie' v-model='mode' value='pie' class="btn-check"/>
                        <label for='top-stats-pie' class="btn btn-sm btn-icon">
                            <ChartPieIcon width='16'/>
                        </label>
                    </div>
                </div>
            </div>
        </div>
        <div class="row">
            <template v-if='mode === "list"'>
                <table class="table card-table table-vcenter">
                    <thead>
                        <tr>
                            <th>User Group</th>
                            <th colspan="2">Users</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr :key='a.name' v-for='a in agg'>
                            <td v-text='a.name'></td>
                            <td v-text='a.count'></td>
                            <td class="w-50">
                                <div class="progress progress-xs">
                                    <div
                                        class="progress-bar bg-primary"
                                        :style='`width: ${a.percent * 100}%;`'
                                    ></div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </template>
            <template v-else>
                <ApexChart
                    :key='random'
                    type='pie'
                    height='350'
                    :options='options'
                    :series='series'
                />
            </template>
        </div>
    </div>
</div>
</template>

<script>
import { TablerSelect } from '@tak-ps/vue-tabler';
import VueApexCharts from 'vue3-apexcharts'
import {
    ChartPieIcon,
    ListIcon
} from 'vue-tabler-icons'

export default {
    name: 'TopStats',
    data: function() {
        return {
            agg: [],
            random: '123',
            mode: 'list',
            current: 'Agency',
            series: [],
            options: {
                labels: []
            },
            convert: {
                Category: 'businesscategory',
                Agency: 'o',
                SubAgency: 'ou',
                Title: 'title',
                ZipCode: 'postalcode'
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        genSeries: function() {
            this.options.labels = [];
            this.series = this.agg.map((a) => {
                this.options.labels.push(a.name);
                return a.percent * 100;
            });

            this.random = (Math.random() + 1).toString(36).substring(7);
        },
        fetch: async function(current) {
            if (this.current === current) return;
            if (current) this.current = current;

            const agg = await window.std(`/api/aggregate/${this.convert[this.current]}`);

            let aggs = [];
            let total = 0;
            for (const name in agg) {
                total += agg[name];
                aggs.push({
                    name,
                    count: agg[name]
                });
            }

            this.agg = aggs.map((agg) => {
                agg.percent = agg.count / total;
                return agg;
            }).sort((a, b) => {
                return b.percent - a.percent;
            }).splice(0, 6);

            this.genSeries();
        }
    },
    components: {
        TablerSelect,
        ApexChart: VueApexCharts,
        ChartPieIcon,
        ListIcon
    }
}
</script>
