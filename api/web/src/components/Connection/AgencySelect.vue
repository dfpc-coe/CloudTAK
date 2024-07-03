<template>
<div>
    <label class='mx-1 mb-1'>Connection Agency</label>
    <div class='card'>
        <div class='card-body'>
            <TablerLoading v-if='loading.main' :inline='true' desc='Loading Agencies'/>
            <template v-else-if='selected.id'>
                <div class='col-12 d-flex align-items-center'>
                    <div v-text='selected.name' />
                    <div class='ms-auto'>
                        <IconTrash
                            v-if='selected.id'
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            v-tooltip='"Remove Agency"'
                            @click='selected.id = null'
                        />
                    </div>
                </div>
            </template>
            <template v-else>
                <TablerInput
                    v-model='filter'
                    placeholder='Filter...'
                />

                <div v-if='loading.list' class='card-body'>
                    <TablerLoading desc='Loading Agencies'/>
                </div>
                <TablerNone
                    v-else-if='data.total === 0'
                    :create='false'
                    :compact='true'
                    label='Agencies'
                />
                <template v-else v-for='agency in data.items'>
                    <div
                        @click='selected = agency'
                        class='hover-light px-2 py-2 cursor-pointer row rounded'
                    >
                        <div class='col-md-12'>
                            <span v-text='agency.name'/>
                        </div>

                        <div class='col-md-8' v-text='agency.description'/>
                    </div>
                </template>
            </template>
        </div>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconSettings,
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';

export default {
    name: 'Agency',
    components: {
        IconTrash,
        IconSettings,
        TablerInput,
        TablerNone,
        TablerLoading
    },
    props: {
        modelValue: Number,
        disabled: {
            type: Boolean,
            default: false
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            loading: {
                main: true,
                list: true,
            },
            filter: '',
            selected: {
                id: '',
                name: ''
            },
            data: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
        selected: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.selected.id);
            }
        },
        filter: async function() {
            await this.listData()
        },
        modelValue: function() {
            if (this.modelValue) this.fetch();
        }
    },
    mounted: async function() {
        if (this.modelValue) await this.fetch();
        await this.listData();
        this.loading.main = false;
    },
    methods: {
        fetch: async function() {
            this.selected = await std(`/api/agency/${this.modelValue}`);
        },
        listData: async function() {
            this.loading.list = true;
            const url = stdurl('/api/agency');
            url.searchParams.append('filter', this.filter);
            this.data = await std(url);
            this.loading.list = false;
        },
    }
};
</script>
