<template>
    <div>
        <div class='card-header d-flex'>
            <h3 class='card-title'>
                Environment
            </h3>
            <div
                v-if='disabled'
                class='ms-auto btn-list'
            >
                <template v-if='disabled && !raw'>
                    <TablerIconButton
                        title='Raw View'
                        @click='raw = true'
                    >
                        <IconCode
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerIconButton
                        v-if='props.capabilities'
                        title='Edit'
                        @click='disabled = false'
                    >
                        <IconPencil
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                </template>
                <template v-else-if='raw'>
                    <TablerIconButton
                        title='Close View'
                        @click='raw = false'
                    >
                        <IconX
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                </template>
            </div>
        </div>

        <div
            v-if='softAlert'
            class='bg-red-lt mx-2 px-2 py-2 my-2 rounded border border-red justify-content-center'
        >
            <div>Output Schema could not be loaded from upstream source:</div>
            <div v-text='softAlert.message' />
        </div>
        <TablerLoading
            v-else-if='!environment'
            desc='Loading Environment'
        />
        <TablerLoading
            v-else-if='loading.save'
            desc='Saving Environment'
        />
        <div
            v-else
            class='col'
        >
            <template v-if='raw'>
                <CopyField
                    :rows='20'
                    :edit='true'
                    :hover='true'
                    :validate='validateJSON'
                    :model-value='JSON.stringify(environment, null, 4)'
                    @update:model-value='environment = JSON.parse($event)'
                />
            </template>
            <TablerAlert
                v-else-if='!props.capabilities'
                title='Missing Capabilities'
                :err='new Error("Layer failed to return a Capabilities object")'
            />
            <TablerAlert
                v-else-if='!props.capabilities?.incoming?.schema?.input'
                title='Missing Input Schema'
                :err='new Error("Layer failed to return an input schema on the Capabilities object")'
            />
            <template v-else-if='direction === "incoming" && props.capabilities.name === "etl-arcgis"'>
                <LayerIncomingEnvironmentArcGIS
                    v-model='environment'
                    :disabled='disabled'
                />
            </template>
            <template v-else-if='direction === "outgoing" && props.capabilities.name === "etl-arcgis"'>
                <LayerOutgoingEnvironmentArcGIS
                    v-model='environment'
                    :disabled='disabled'
                />
            </template>
            <template
                v-else-if='
                    (props.capabilities[direction] as DirectionCapability)?.schema?.input?.type !== "object"
                        || !(props.capabilities[direction] as DirectionCapability)?.schema?.input?.properties
                '
            >
                <div class='d-flex justify-content-center my-4'>
                    Only Object Schemas are Supported.
                </div>
            </template>
            <template v-else>
                <TablerNone
                    v-if='Object.keys(inputSchema.properties).length === 0'
                    label='No Schema'
                    :create='false'
                />
                <Schema
                    v-else
                    v-model='environment'
                    :schema='inputSchema'
                    :disabled='disabled'
                />
            </template>

            <div class='px-2 pb-3'>
                <!-- AutoSuggested Filters -->
                <template v-if='(config.timezone as Record<string, unknown>)'>
                    <TablerTimeZone
                        v-model='(config.timezone as Record<string, string>).timezone'
                        label='Date TimeZone Override'
                        :disabled='disabled'
                    />
                </template>
            </div>

            <div
                v-if='!disabled || raw'
                class='col-12 px-2 py-2 d-flex'
            >
                <button
                    class='btn'
                    @click='reload'
                >
                    Cancel
                </button>
                <div class='ms-auto'>
                    <button
                        class='btn btn-primary'
                        @click='saveLayer'
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std } from '../../../std.ts';
import type { ETLLayer, ETLLayerTaskCapabilities } from '../../../types.ts';
import { validateJSON } from '../../../base/validators.ts';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
    TablerTimeZone,
} from '@tak-ps/vue-tabler';
import CopyField from '../../CloudTAK/util/CopyField.vue';
import LayerIncomingEnvironmentArcGIS from './LayerIncomingEnvironmentArcGIS.vue';
import LayerOutgoingEnvironmentArcGIS from './LayerOutgoingEnvironmentArcGIS.vue';
import Schema from './utils/Schema.vue';
import {
    IconX,
    IconCode,
    IconPencil,
} from '@tabler/icons-vue'

interface SchemaProperty {
    type?: string;
    enum?: string[];
    default?: unknown;
    description?: string;
    items: SchemaDefinition;
    [key: string]: unknown;
}

interface SchemaDefinition {
    type?: string;
    required: string[];
    properties: Record<string, SchemaProperty>;
    [key: string]: unknown;
}

interface DirectionCapability {
    schema: {
        input: SchemaDefinition;
        inputError?: { status: number; message: string };
        output: SchemaDefinition;
        outputError?: { status: number; message: string };
    };
    [key: string]: unknown;
}

const props = defineProps<{
    layer: ETLLayer;
    capabilities: ETLLayerTaskCapabilities;
}>();

const emit = defineEmits<{
    (e: 'refresh'): void;
}>();

const route = useRoute();

const direction = ref<'incoming' | 'outgoing'>(String(route.name).includes('incoming') ? 'incoming' : 'outgoing');

const raw = ref(false);
const softAlert = ref<{ message: string } | false>(false);
const disabled = ref(true);
const config = ref<Record<string, unknown>>({});
const environment = ref<Record<string, unknown>>();

const loading = ref({
    save: false
});

const inputSchema = computed((): SchemaDefinition => {
    const cap = dirCap();
    if (!cap?.schema?.input) return { required: [], properties: {} };
    const input = cap.schema.input as SchemaDefinition;
    return {
        ...input,
        required: input.required ?? [],
        properties: input.properties ?? {},
    };
});

onMounted(async () => {
    await reload();
});

function dirCap(): DirectionCapability | undefined {
    return props.capabilities[direction.value] as DirectionCapability | undefined;
}

function hasDateTime(): boolean {
    if (!props.capabilities) return false;
    const cap = dirCap();
    if (!cap?.schema.output?.properties) return false;

    for (const prop of Object.keys(cap.schema.output.properties)) {
        if (cap.schema.output.properties[prop].format === 'date-time') {
            return true;
        }
    }

    return false;
}

async function reload() {
    raw.value = false;
    disabled.value = true;

    const layerDir = props.layer[direction.value] as { environment: Record<string, unknown>; config: Record<string, unknown> } | undefined;
    environment.value = layerDir ? JSON.parse(JSON.stringify(layerDir.environment)) : {};

    if (direction.value === 'incoming' && layerDir) {
        const cnf = JSON.parse(JSON.stringify(layerDir.config)) as Record<string, unknown>;

        if (!hasDateTime()) {
            delete cnf.timezone;
        } else if (!cnf.timezone) {
            cnf.timezone = { timezone: 'No TimeZone' }
        }

        config.value = cnf;
    }

    disabled.value = true;
}

async function saveLayer() {
    loading.value.save = true;

    await std(`/api/connection/${props.layer.connection}/layer/${props.layer.id}/${direction.value}`, {
        method: 'PATCH',
        body: {
            environment: environment.value,
            config: config.value
        }
    });

    disabled.value = true;
    loading.value.save = false;

    emit('refresh');
}
</script>
