<template>
    <div
        data-bs-theme='dark'
        class='row'
    >
        <div class='col-12 d-flex my-1'>
            <span
                v-if='description'
                class='align-self-center'
            >
                <IconInfoSquare
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='help = true'
                />
                <TablerHelp
                    v-if='help'
                    :label='label || placeholder'
                    :description='description'
                    @click='help = false'
                />
            </span>
            <div
                class='align-self-center px-2'
                :class='{ "required": required }'
                v-text='label'
            />
            <div class='ms-auto align-self-center'>
                <slot />
            </div>
        </div>

        <TablerLoading
            v-if='loading.iconset'
            desc='Loading Iconsets'
        />
        <template v-else>
            <div class='d-flex'>
                <template v-if='selected.name'>
                    <div class='d-flex align-items-center'>
                        <img
                            :src='iconurl(selected)'
                            style='width: 25px; height: auto; margin-right: 5px;'
                        >
                        <span
                            class='mt-2 mx-2'
                            v-text='selected.name'
                        />
                    </div>
                </template>
                <template v-else>
                    <span class='text-center my-2 mx-2'>No Icon Selected</span>
                </template>

                <div
                    v-if='!disabled'
                    class='btn-list ms-auto'
                >
                    <IconTrash
                        v-if='selected.name'
                        v-tooltip='"Remove Icon"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='removeIcon'
                    />

                    <TablerDropdown>
                        <template #default>
                            <IconSettings
                                v-tooltip='"Select Icon"'
                                :size='32'
                                stroke='1'
                                class='cursor-pointer'
                            />
                        </template>
                        <template #dropdown>
                            <div class='card'>
                                <div class='card-header d-flex align-items-center'>
                                    <h3 class='card-title'>
                                        Notifications
                                    </h3>
                                </div>

                                <div class='card-body'>
                                    <label class='w-100 subheader d-flex'>
                                        <span class='mx-2 d-flex justify-content-center align-items-center'>Iconsets</span>
                                        <IconSearch
                                            :size='32'
                                            stroke='1'
                                            class='ms-auto cursor-pointer mx-2'
                                            @click.stop.prevent='params.showFilter = !params.showFilter'
                                        />
                                    </label>
                                    <TablerEnum
                                        v-model='params.iconset'
                                        :options='setsName'
                                    />
                                    <TablerInput
                                        v-if='params.showFilter'
                                        v-model='params.filter'
                                        placeholder='Icon Search'
                                    />
                                    <TablerLoading
                                        v-if='loading.icons'
                                        desc='Loading Icons'
                                    />
                                    <div
                                        v-else
                                        class='row mx-2 my-2'
                                    >
                                        <div
                                            v-for='icon of list.items'
                                            :key='icon.id'
                                            class='col-auto cursor-pointer'
                                            @click='selected = icon'
                                        >
                                            <img
                                                v-tooltip='icon.name'
                                                :src='iconurl(icon)'
                                                style='width: 25px; height: 25px; margin-right: 5px;'
                                            >
                                        </div>
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
import { std, stdurl } from '/src/std.ts';
import {
    IconInfoSquare,
    IconTrash,
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
    components: {
        TablerHelp,
        TablerInput,
        TablerDropdown,
        IconInfoSquare,
        IconSearch,
        IconTrash,
        IconSettings,
        TablerEnum,
        TablerLoading
    },
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
        },
        label: {
            type: String,
            default: 'Icon Select'
        }
    },
    emits: [
        'update:modelValue'
    ],
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
                path: '',
                name: ''
            },
            sets: [],
            list: {
                total: 0,
                items: []
            }
        }
    },
    computed: {
        setsName: function() {
            return this.sets.map((set) => { return set.name });
        }
    },
    watch: {
        selected: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.selected.path);
            }
        },
        'params': {
            deep: true,
            handler: async function() {
                await this.Iconlists();
            },
        },
        modelValue: async function() {
            await this.fetch();
        }
    },
    mounted: async function() {
        await this.fetch();
        await this.Iconlistsets();
        await this.Iconlists();
    },
    methods: {
        removeIcon: function() {
            this.selected.path = '';
            this.selected.iconset = false;
            this.selected.name = '';
        },
        iconurl: function(icon) {
            const url = stdurl(`/api/iconset/${icon.iconset}/icon/${encodeURIComponent(icon.name)}/raw`);
            url.searchParams.append('token', localStorage.token);
            return String(url);
        },
        fetch: async function() {
            // This is unfortuantely but the CloudTAK Map uses the MapLibre Icon format
            // While the backend uses the TAK Icon Format
            if (
                this.modelValue
                && (
                    this.modelValue.includes(":")
                    || this.modelValue.split('/').length === 3
                )
            ) {
                let path = this.modelValue;

                // MapLibre needs the palette name seperated by a ":" isntead of a "/"
                if (path.includes(':')) path = path.split(':').join('/') + '.png';

                const iconset = path.split('/')[0];
                const icon = path.split('/').splice(1).join('/');
                this.selected = await std(`/api/iconset/${iconset}/icon/${encodeURIComponent(icon)}`);
            }
        },
        Iconlistsets: async function() {
            this.loading.iconsets = true;
            const url = stdurl('/api/iconset');
            url.searchParams.append('limit', 20);
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
    }
};
</script>
