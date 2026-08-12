<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Core Events'
    >
        <template #right>
            <TablerIconButton
                v-if='!edit && isOpen'
                title='Edit'
                @click.stop='edit = true'
            >
                <IconPencil stroke='1' />
            </TablerIconButton>
            <div
                v-else-if='edit && isOpen'
                class='d-flex gap-1'
            >
                <TablerIconButton
                    color='rgba(var(--tblr-primary-rgb), 0.14)'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy
                        color='rgb(var(--tblr-primary-rgb))'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX stroke='1' />
                </TablerIconButton>
            </div>
        </template>

        <div class='col-lg-12 py-2 px-2 border rounded'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />

                <div class='d-flex align-items-center justify-content-between mb-3'>
                    <p class='text-secondary mb-0'>
                        Configure preconfigured Event Types that users can choose from when creating a new Core Event.
                    </p>

                    <TablerIconButton
                        v-if='edit'
                        title='Add Event Type'
                        @click='addType()'
                    >
                        <IconPlus
                            color='rgb(var(--tblr-primary-rgb))'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>

                <template v-if='config["core::event::types"].length'>
                    <div
                        v-for='(eventType, index) in config["core::event::types"]'
                        :key='index'
                        class='border rounded p-3 mb-3'
                    >
                        <div class='d-flex align-items-center justify-content-between mb-3'>
                            <h4 class='card-title mb-0'>
                                Event Type {{ index + 1 }}
                            </h4>

                            <TablerIconButton
                                v-if='edit'
                                title='Remove Event Type'
                                @click='removeType(index)'
                            >
                                <IconTrash
                                    color='rgb(var(--tblr-danger-rgb))'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>

                        <div class='row g-3'>
                            <div
                                v-if='!edit && eventType.icon'
                                class='col-lg-3 col-md-4'
                            >
                                <label class='form-label'>Custom Icon</label>
                                <div class='border rounded d-flex align-items-center justify-content-center p-3 h-100'>
                                    <img
                                        :src='eventType.icon'
                                        alt='Event Type icon'
                                        class='img-fluid'
                                        style='max-height: 120px; object-fit: contain;'
                                    >
                                </div>
                            </div>

                            <div :class='!edit && eventType.icon ? "col-lg-9 col-md-8" : "col-12"'>
                                <TablerInput
                                    v-model='eventType.name'
                                    :disabled='!edit'
                                    :error='edit ? typeNameError(eventType) : ""'
                                    label='Name'
                                    placeholder='Wildfire'
                                />

                                <label class='form-label mt-3'>2525E Symbol</label>
                                <template v-if='eventType.type'>
                                    <div
                                        class='d-flex align-items-center gap-2 px-3 form-select'
                                        style='cursor: default;'
                                    >
                                        <span
                                            class='flex-grow-1 user-select-none text-truncate font-monospace'
                                            v-text='symbolLabel(eventType.type)'
                                        />
                                        <IconX
                                            v-if='edit'
                                            :size='16'
                                            stroke='1'
                                            class='cursor-pointer flex-shrink-0 text-muted'
                                            @click.stop='clearSymbol(index)'
                                        />
                                    </div>
                                </template>
                                <template v-else-if='edit'>
                                    <TablerInput
                                        v-model='symbolFilter'
                                        icon='search'
                                        placeholder='Search 2525E Symbols...'
                                        @update:model-value='pickerIndex = index'
                                    />
                                    <TablerLoading
                                        v-if='symbolLoading'
                                        :compact='true'
                                        desc='Loading Symbols'
                                    />
                                    <TablerNone
                                        v-else-if='!symbols.length'
                                        :compact='true'
                                        :create='false'
                                        label='No Symbols'
                                    />
                                    <div
                                        v-else
                                        class='overflow-auto border rounded'
                                        style='max-height: 200px;'
                                    >
                                        <div
                                            v-for='symbol in symbols'
                                            :key='symbol.sidc'
                                            class='px-2 py-1 cloudtak-hover cursor-pointer user-select-none text-truncate'
                                            @click='selectSymbol(index, symbol)'
                                        >
                                            {{ symbol.name }}
                                        </div>
                                    </div>
                                </template>

                                <TablerUploadLogo
                                    v-if='edit'
                                    v-model='eventType.icon'
                                    :input-id='`core-event-type-icon-${index}`'
                                    label='Custom Icon (Optional)'
                                />
                            </div>
                        </div>
                    </div>
                </template>

                <TablerNone
                    v-else
                    label='No preconfigured Event Types'
                    :create='false'
                />
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import { validateTextNotEmpty } from '../../../utils/validators.ts';
import {
    TablerLoading,
    TablerNone,
    TablerInput,
    TablerIconButton,
    TablerAlert,
    TablerUploadLogo
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconPlus,
    IconTrash,
    IconX
} from '@tabler/icons-vue';

type CoreEventType = {
    name: string;
    type: string;
    icon: string;
};

type CoreEventTypesConfig = {
    'core::event::types': CoreEventType[];
};

type Symbol2525E = {
    sidc: string;
    name: string;
};

function createType(): CoreEventType {
    return {
        name: '',
        type: '',
        icon: '',
    };
}

function cloneTypes(types: unknown): CoreEventType[] {
    if (!Array.isArray(types)) return [];

    return types.map((eventType) => {
        const value = eventType as Partial<CoreEventType> | null;

        return {
            name: typeof value?.name === 'string' ? value.name : '',
            type: typeof value?.type === 'string' ? value.type : '',
            icon: typeof value?.icon === 'string' ? value.icon : '',
        };
    });
}

const isOpen = ref(false);
const loading = ref(false);
const edit = ref(false);
const err = ref<Error | null>(null);

const pickerIndex = ref<number | undefined>(undefined);
const symbolFilter = ref('');
const symbolLoading = ref(false);
const symbols = ref<Symbol2525E[]>([]);
const symbolNames = ref<Record<string, string>>({});

const config = ref<CoreEventTypesConfig>({
    'core::event::types': [],
});

onMounted(async () => {
    if (isOpen.value) void fetch();
    await fetchSymbols();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) void fetch();
});

watch(symbolFilter, async () => {
    await fetchSymbols();
});

function typeNameError(eventType: CoreEventType): string {
    return validateTextNotEmpty(eventType.name.trim());
}

function isEmptyType(eventType: CoreEventType): boolean {
    return !eventType.name.trim() && !eventType.type.trim() && !eventType.icon.trim();
}

function symbolLabel(sidc: string): string {
    return symbolNames.value[sidc] || sidc;
}

function selectSymbol(index: number, symbol: Symbol2525E): void {
    config.value['core::event::types'][index].type = symbol.sidc;
    symbolNames.value[symbol.sidc] = symbol.name;
    pickerIndex.value = undefined;
    symbolFilter.value = '';
}

function clearSymbol(index: number): void {
    config.value['core::event::types'][index].type = '';
}

function addType(): void {
    config.value['core::event::types'].push(createType());
}

function removeType(index: number): void {
    config.value['core::event::types'].splice(index, 1);
}

async function fetchSymbols(): Promise<void> {
    try {
        symbolLoading.value = true;
        const res = await server.GET('/api/type/2525e', {
            params: {
                query: {
                    filter: symbolFilter.value,
                    identity: 'f',
                    limit: 20
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        symbols.value = res.data.items.map((item) => {
            return { sidc: item.sidc, name: item.name };
        });
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    symbolLoading.value = false;
}

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const { data, error } = await server.GET('/api/config', {
            params: {
                query: {
                    keys: 'core::event::types'
                }
            }
        });
        if (error) throw new Error(error.message);

        config.value['core::event::types'] = cloneTypes(data['core::event::types']);
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}

async function save(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const types = cloneTypes(config.value['core::event::types'])
            .map((eventType) => ({
                name: eventType.name.trim(),
                type: eventType.type.trim(),
                icon: eventType.icon,
            }))
            .filter((eventType) => !isEmptyType(eventType));

        const invalid = types.find((eventType) => {
            return Boolean(typeNameError(eventType)) || !eventType.type;
        });

        if (invalid) {
            throw new Error(`Invalid Event Type entry: ${typeNameError(invalid) || 'A 2525E Symbol is required'}`);
        }

        const { error } = await server.PUT('/api/config', {
            body: {
                'core::event::types': types.map((eventType) => ({
                    name: eventType.name,
                    type: eventType.type,
                    ...(eventType.icon ? { icon: eventType.icon } : {}),
                })),
            }
        });
        if (error) throw new Error(error.message);

        edit.value = false;
        await fetch();
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Core Event config:', error);
    }

    loading.value = false;
}
</script>
