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
            <template v-if='selected.name'>
                <div class='d-flex mx-2'>
                    <img :src='iconurl(selected)' style='width: 25px; height: auto; margin-right: 5px;'>
                    <span class='mt-2' v-text='selected.name'/>
                </div>
            </template>
            <template v-else>
                <span class='text-center w-100 my-2'>No Icon Selected</span>
            </template>

            <div v-if='!disabled' class='ms-auto'>
                <TablerDropdown>
                    <template #default>
                        <SettingsIcon class='cursor-pointer dropdown-toggle'/>
                    </template>
                    <template #dropdown>
                        <div class='mx-2'>
                            <TablerInput v-model='filter'/>
                            <div @click='selected = icon' :key='icon.id' v-for='icon of list.icons' class='cursor-pointer'>
                                <div class='d-flex my-1'>
                                    <img :src="iconurl(icon)" style='width: 25px; height: 25px; margin-right: 5px;'>
                                    <span class='mt-2' v-text='icon.name'/>
                                </div>
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
import {
    InfoSquareIcon,
    SettingsIcon
} from 'vue-tabler-icons';
import {
    TablerHelp,
    TablerInput,
    TablerDropdown,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'IconSelect',
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
            filter: '',
            selected: {
                iconset: false,
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
            this.$emit('update:modelValue', this.selected.path);
        },
        filter: async function() {
            await this.listIcons();
        },
        modelValue: function() {
            if (this.modelValue) this.fetch();
        }
    },
    mounted: async function() {
        if (this.modelValue) await this.fetch();
        await this.listIcons();
        this.loading = false;
    },
    methods: {
        iconurl: function(icon) {
            const url = window.stdurl(`/api/iconset/${icon.iconset}/icon/${icon.name}/raw`);
            url.searchParams.append('token', localStorage.token);
            return String(url);
        },
        fetch: async function() {
            this.selected = await window.std(`/api/icon/${this.modelValue}`);
        },
        listIcons: async function() {
            const url = window.stdurl('/api/icon');
            url.searchParams.append('limit', 10);
            url.searchParams.append('filter', this.filter);
            this.list = await window.std(url)
        },
    },
    components: {
        TablerHelp,
        TablerInput,
        TablerDropdown,
        InfoSquareIcon,
        SettingsIcon,
        TablerLoading
    }
};
</script>
