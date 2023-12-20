<template>
<div class='w-100'>
    <template v-if='loading'>
        <TablerLoading :inline='true'/>
    </template>
    <template v-else>
        <div class='d-flex'>
            <template v-if='selected.id'>
                <span class='mt-2' v-text='selected.name'/>
            </template>
            <template v-else>
                <span class='mt-2'>No Data Repo Selected</span>
            </template>

            <div v-if='!disabled' class='ms-auto'>
                <div class="dropdown">
                    <div class="dropdown-toggle" type="button" id="dropdownMenuButton1" data-bs-toggle="dropdown" aria-expanded="false">
                        <IconSettings
                            class='cursor-pointer dropdown-toggle'
                        />
                    </div>
                    <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton1">
                        <div class='m-1'>
                            <div class='table-resposive'>
                                <table class='table table-hover'>
                                    <thead>
                                        <tr>
                                            <th>(Status) Name</th>
                                        </tr>
                                    </thead>
                                    <tbody class='table-tbody'>
                                        <tr @click='selected = data' :key='data.id' v-for='data of data.data' class='cursor-pointer'>
                                            <td>
                                                <div class='d-flex'>
                                                    <span class='mt-2' v-text='data.name'/>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </ul>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import {
    IconSettings
} from '@tabler/icons-vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataSelect',
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
            selected: {
                id: '',
                name: ''
            },
            data: {
                total: 0,
                data: []
            }
        }
    },
    watch: {
        selected: function() {
            this.$emit('update:modelValue', this.selected.id);
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
            this.selected = await window.std(`/api/data/${this.modelValue}`);
        },
        listData: async function() {
            this.data = await window.std('/api/data');
        },
    },
    components: {
        IconSettings,
        TablerLoading
    }
};
</script>
