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
                v-else-if='!props.capabilities.incoming.schema.input'
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
                    props.capabilities[direction].schema.input.type !== "object"
                        || !props.capabilities[direction].schema.input.properties
                '
            >
                <div class='d-flex justify-content-center my-4'>
                    Only Object Schemas are Supported.
                </div>
            </template>
            <template v-else>
                <TablerNone
                    v-if='Object.keys(capabilities[direction].schema.input.properties).length === 0'
                    label='Schema'
                    :create='false'
                />
                <Schema
                    v-else
                    v-model='environment'
                    :schema='capabilities[direction].schema.input'
                    :disabled='disabled'
                />
            </template>

            <div class='px-2 pb-3'>
                <!-- AutoSuggested Filters -->
                <template v-if='config.timezone'>
                    <TablerTimeZone
                        v-model='config.timezone.timezone'
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

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std } from '../../../std.ts';
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

const props = defineProps({
    layer: {
        type: Object,
        required: true
    },
    capabilities: {
        type: Object,
        required: true
    }
});

const emit = defineEmits([ 'refresh' ]);

const route = useRoute();

const direction = ref(route.name.includes('incoming') ? 'incoming' : 'outgoing');

const raw = ref(false);
const softAlert = ref(false);
const disabled = ref(true);
const config = ref({});
const environment = ref();

const loading = ref({
    save: false
});

onMounted(async () => {
    await reload();
});

function hasDateTime() {
    if (!props.capabilities) return false;

    if (props.capabilities[direction.value].schema.output) {
        for (const prop of Object.keys(props.capabilities[direction.value].schema.output.properties)) {
            if (props.capabilities[direction.value].schema.output.properties[prop].format && props.capabilities[direction.value].schema.output.properties[prop].format === 'date-time') {
                return true;
            }
        }
    }

    return false;
}

async function reload() {
    raw.value = false;
    disabled.value = true;

    environment.value = JSON.parse(JSON.stringify(props.layer[direction.value].environment));

    if (direction.value === 'incoming')  {
        const cnf = JSON.parse(JSON.stringify(props.layer[direction.value].config));

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
