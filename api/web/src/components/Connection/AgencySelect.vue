<template>
    <div>
        <div class='d-flex align-items-center'>
            <label class='mx-1 mb-1'>Connection Agency</label>
            <div
                v-if='profile.system_admin'
                class='ms-auto'
            >
                <TablerToggle
                    v-model='noAgency'
                    label='System Admin Connection - No Owning Agency'
                />
            </div>
        </div>
        <div class='card'>
            <template v-if='noAgency'>
                <TablerNone
                    :create='false'
                    :compact='true'
                    label='Agency - System Admin Access Only'
                />
            </template>
            <template v-else>
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
                            placeholder='Agency Filter...'
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
                            v-for='agency in data.items'
                            v-else
                        >
                            <div
                                class='hover-light px-2 py-2 cursor-pointer row rounded'
                                @click='selected = agency'
                            >
                                <div class='col-md-12'>
                                    <span v-text='agency.name' />
                                </div>

                                <div
                                    class='col-md-8'
                                    v-text='agency.description'
                                />
                            </div>
                        </template>
                    </template>
                </div>
            </template>
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
    TablerToggle,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import { useProfileStore } from '/src/stores/profile.ts';
import { mapState } from 'pinia'
import { debounce } from 'radash'

export default {
    name: 'Agency',
    components: {
        IconTrash,
        TablerToggle,
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
            noAgency: false,
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
                if (!this.noAgency) {
                    this.$emit('update:modelValue', this.selected.id);
                }
            }
        },
        noAgency: function() {
            if (this.noAgency) {
                this.selected.id = '';
                this.$emit('update:modelValue', null);
            }
        },
        filter: async function() {
            await this.listData()
        },
        modelValue: function() {
            if (this.modelValue) this.fetch();
        }
    },
    computed: {
        ...mapState(useProfileStore, ['profile']),
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
        listData: debounce(async function() {
            this.loading.list = true;
            const url = stdurl('/api/agency');
            url.searchParams.append('filter', this.filter);
            const data = await std(url);

            if (!this.profile.system_admin && data.total === 1) {
                this.selected.name = data.items[0].name;
                this.selected.id = data.items[0].id;
            }

            this.data = data;

            this.loading.list = false;
        }, 600),
    }
};
</script>
