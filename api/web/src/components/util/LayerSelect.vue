<template>
    <div>
        <div class='d-flex align-items-center'>
            <label class='mx-1 mb-1'>Layer Selection</label>
        </div>
        <div class='card'>
            <div class='card-body'>
                <TablerLoading
                    v-if='loading.main'
                    :inline='true'
                    desc='Loading Agencies'
                />
                <template v-else-if='selected.id'>
                    <div class='col-12 d-flex align-items-center'>
                        <div v-text='selected.name' />
                        <div class='ms-auto'>
                            <IconTrash
                                v-if='selected.id && data.total > 1'
                                v-tooltip='"Remove Agency"'
                                :size='32'
                                :stroke='1'
                                class='cursor-pointer'
                                @click='selected.id = null'
                            />
                        </div>
                    </div>
                </template>
                <template v-else>
                    <TablerInput
                        v-model='filter'
                        placeholder='Layer Filter...'
                    />

                    <div
                        v-if='loading.list'
                        class='card-body'
                    >
                        <TablerLoading desc='Loading Agencies' />
                    </div>
                    <TablerNone
                        v-else-if='data.total === 0'
                        :create='false'
                        :compact='true'
                        label='Agencies'
                    />
                    <template
                        v-for='layer in data.items'
                        v-else
                    >
                        <div
                            class='hover-light px-2 py-2 cursor-pointer row rounded'
                            @click='selected = layer'
                        >
                            <div class='col-md-4'>
                                <span v-text='layer.name' />
                            </div>

                            <div
                                class='col-md-8'
                                v-text='layer.description'
                            />
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
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';

export default {
    name: 'LayerSelect',
    components: {
        IconTrash,
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
            this.selected = await std(`/api/layer/${this.modelValue}`);
        },
        listData: async function() {
            this.loading.list = true;
            const url = stdurl('/api/layer');
            url.searchParams.append('filter', this.filter);
            const data = await std(url);

            this.data = data;

            this.loading.list = false;
        },
    }
};
</script>
