<template>
<div class='row'>
    <div class='col-12 d-flex my-1'>
        <span v-if='description' class='align-self-center'>
            <InfoSquareIcon @click='help = true' size='20' class='cursor-pointer'/>
            <TablerHelp v-if='help' @click='help = false' :label='label || placeholder' :description='description'/>
        </span>
        <div class="align-self-center px-2" :class='{ "required": required }' >Icon Select</div>
        <div class='ms-auto align-self-center'><slot/></div>
    </div>

    <template v-if='loading'>
        <TablerLoading/>
    </template>
    <template v-else>
        <div class='d-flex'>
            <template v-if='selected.id'>
                <div class='d-flex mx-2'>
                    <img :src="`/icons/${selected.file}`" style='width: 25px; height: auto; margin-right: 5px;'>
                    <span class='mt-2' v-text='selected.name'/>
                </div>
            </template>
            <template v-else>
                <span class='text-center w-100'>No Icon Selected</span>
            </template>

            <div v-if='!disabled' class='ms-auto'>
                <div class="dropdown">
                    <div class="dropdown-toggle" type="button" id="dropdownMenuButton1" data-bs-toggle="dropdown" aria-expanded="false">
                        <SettingsIcon
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
                                        <tr @click='selected = icon' :key='icon.id' v-for='icon of list.icons' class='cursor-pointer'>
                                            <td>
                                                <div class='d-flex'>
                                                    <img :src="`/icons/${icon.file}`" style='width: 25px; height: auto; margin-right: 5px;'>
                                                    <span class='mt-2' v-text='icon.name'/>
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
    InfoSquareIcon,
    SettingsIcon
} from 'vue-tabler-icons';
import {
    TablerHelp,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionSelect',
    props: {
        modelValue: {
            type: String,
            required: true
        },
        description: {
            type: String,
            default: ''
        },
        required: {
            type: Boolean,
            default: false
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            help: false,
            loading: true,
            selected: {
                id: '',
                status: 'dead',
                name: ''
            },
            list: {
                total: 0,
                icons: []
            }
        }
    },
    watch: {
        selected: function() {
            this.$emit('update:modelValue', this.selected.file);
        },
        modelValue: function() {
            if (this.modelValue) this.fetch();
        }
    },
    mounted: async function() {
        if (this.modelValue) await this.fetch();
        await this.listConnections();
        this.loading = false;
    },
    methods: {
        fetch: async function() {
            this.selected = await window.std(`/api/icon/${this.modelValue}`);
        },
        listConnections: async function() {
            this.list = await window.std('/api/icon');
        },
    },
    components: {
        TablerHelp,
        InfoSquareIcon,
        SettingsIcon,
        TablerLoading
    }
};
</script>
