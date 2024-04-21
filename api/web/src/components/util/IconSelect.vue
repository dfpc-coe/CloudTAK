<template>
<div class='row'>
    <div class='col-12 d-flex my-1'>
        <span v-if='description' class='align-self-center'>
            <IconInfoSquare @click='help = true' size='20' class='cursor-pointer'/>
            <TablerHelp v-if='help' @click='help = false' :label='label || placeholder' :description='description'/>
        </span>
        <div class="align-self-center px-2" :class='{ "required": required }' >Icon Select</div>
        <div class='ms-auto align-self-center'><slot/></div>
    </div>

    <TablerLoading desc='Loading Iconsets' v-if='loading.iconset'/>
    <template v-else>
        <div class='d-flex'>
            <template v-if='selected.name'>
                <div class='d-flex align-items-center'>
                    <img :src='iconurl(selected)' style='width: 25px; height: auto; margin-right: 5px;'>
                    <span class='mt-2 mx-2' v-text='selected.name'/>
                </div>
            </template>
            <template v-else>
                <span class='text-center w-100 my-2'>No Icon Selected</span>
            </template>

            <div v-if='!disabled' class='ms-auto'>
                <TablerDropdown>
                    <template #default>
                        <IconSettings size='32' class='cursor-pointer dropdown-toggle'/>
                    </template>
                    <template #dropdown>
                        <label class='w-100 subheader d-flex'>
                            <span class='mx-2 d-flex justify-content-center align-items-center'>Iconsets</span>
                            <IconSearch @click.stop.prevent='params.showFilter = !params.showFilter' size='32' class='ms-auto cursor-pointer mx-2'/>
                        </label>
                        <TablerEnum v-model='params.iconset' :options='setsName'/>
                        <TablerInput v-if='params.showFilter' placeholder='Icon Search' v-model='params.filter'/>
                        <TablerLoading desc='Loading Icons' v-if='loading.icons'/>
                        <div v-else class='row mx-2 my-2'>
                            <div
                                @click='selected = icon'
                                :key='icon.id'
                                v-for='icon of list.items'
                                class='col-auto cursor-pointer'
                            >
                                <img
                                    :src="iconurl(icon)"
                                    style='width: 25px; height: 25px; margin-right: 5px;'
                                    v-tooltip='icon.name'
                                >
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
    IconInfoSquare,
    IconSearch,
    IconSettings
} from '@tabler/icons-vue';
import {
    TablerHelp,
    TablerEnum,
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
    computed: {
        setsName: function() {
            return this.sets.map((set) => { return set.name });
        }
    },
    data: function() {
        return {
            help: false,
            loading: {
               iconsets: true,
               icons: true
           },
            params: {
                iconset: '',
                showFilter: false,
                filter: '',
            },
            selected: {
                iconset: false,
                name: ''
            },
            sets: [],
            list: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
        selected: function() {
            this.$emit('update:modelValue', this.selected.path);
        },
        'params': {
            deep: true,
            handler: async function() {
                await this.Iconlists();
            },
        },
        modelValue: function() {
            if (this.modelValue) this.fetch();
        }
    },
    mounted: async function() {
        if (this.modelValue) await this.fetch();
        await this.Iconlistsets();
        await this.Iconlists();
    },
    methods: {
        iconurl: function(icon) {
            const url = stdurl(`/api/iconset/${icon.iconset}/icon/${encodeURIComponent(icon.name)}/raw`);
            url.searchParams.append('token', localStorage.token);
            return String(url);
        },
        fetch: async function() {
            const iconset = this.modelValue.split('/')[0];
            const icon = this.modelValue.split('/').splice(1).join('/');
            this.selected = await std(`/api/iconset/${iconset}/icon/${encodeURIComponent(icon)}`);
        },
        Iconlistsets: async function() {
            this.loading.iconsets = true;
            const url = stdurl('/api/iconset');
            this.sets = (await std(url)).items;
            this.params.iconset = this.sets[0].name;
            this.loading.iconsets = false;
        },
        Iconlists: async function() {
            this.loading.icons = true;
            let url = stdurl(`/api/icon`);
            if (this.params.iconset) {
                const id = this.sets.filter((set) => {
                    return set.name === this.params.iconset;
                })[0];

                if (id) url.searchParams.append('iconset', id.uid);
            }

            url.searchParams.append('filter', this.params.filter);
            this.list = await std(url)
            this.loading.icons = false;
        },
    },
    components: {
        TablerHelp,
        TablerInput,
        TablerDropdown,
        IconInfoSquare,
        IconSearch,
        IconSettings,
        TablerEnum,
        TablerLoading
    }
};
</script>
