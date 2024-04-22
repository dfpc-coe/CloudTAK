<template>
<div class='w-100'>
    <template v-if='loading'>
        <TablerLoading :inline='true'/>
    </template>
    <template v-else>
        <div class='d-flex align-items-center'>
            <div v-if='selected.id' v-text='selected.name'></div>
            <div v-else>No Agency Selected</div>

            <div v-if='!disabled' class='ms-auto'>
                <TablerDropdown>
                    <IconSettings
                        size='32'
                        class='cursor-pointer dropdown-toggle'
                    />

                    <template #dropdown>
                        <div class='m-1'>
                            <TablerInput v-model='filter' placeholder='Filter...'/>

                            <TablerNone v-if='data.total === 0' :create='false' label='Agencies'/>
                            <div v-else class='table-resposive'>
                                <table class='table table-hover'>
                                    <thead>
                                        <tr>
                                            <th>Agency Name</th>
                                        </tr>
                                    </thead>
                                    <tbody class='table-tbody'>
                                        <tr @click='selected = data' :key='data.id' v-for='data of data.items' class='cursor-pointer'>
                                            <td>
                                                <div class='d-flex align-items-center'>
                                                    <span class='mt-2' v-text='data.name'/>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </template>
                </TablerDropdown>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconSettings
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerInput,
    TablerNone,
    TablerDropdown
} from '@tak-ps/vue-tabler';

export default {
    name: 'Agency',
    props: {
        modelValue: Number,
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            loading: true,
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
        selected: function() {
            this.$emit('update:modelValue', this.selected.id);
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
        this.loading = false;
    },
    methods: {
        fetch: async function() {
            this.selected = await std(`/api/agency/${this.modelValue}`);
        },
        listData: async function() {
            const url = stdurl('/api/agency');
            url.searchParams.append('filter', this.filter);
            this.data = await std(url);
        },
    },
    components: {
        IconSettings,
        TablerDropdown,
        TablerInput,
        TablerNone,
        TablerLoading
    }
};
</script>
