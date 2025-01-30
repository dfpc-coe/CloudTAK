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
                <template v-if='!raw && disabled'>
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
                <pre v-text='environment' />
            </template>
            <template v-else-if='alert'>
                <TablerAlert
                    title='Layer failed to return an Environment Schema'
                    :err='alert'
                />
            </template>
            <template v-else-if='capabilities.incoming.schema.input.display === "arcgis"'>
                <LayerEnvironmentArcGIS
                    v-model='environment'
                    :disabled='disabled'
                />
            </template>
            <template v-else-if='capabilities.incoming.schema.input.type !== "object"'>
                <div class='d-flex justify-content-center my-4'>
                    Only Object Schemas are Supported.
                </div>
            </template>
            <template v-else>
                <Schema
                    v-model='environment'
                    :schema='capabilities.incoming.schema.input'
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
                v-if='!disabled'
                class='col-12 px-2 py-2 d-flex'
            >
                <button
                    v-if='!editing'
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
import { std } from '/src/std.ts';
import {
    TablerAlert,
    TablerLoading,
    TablerIconButton,
    TablerTimeZone,
} from '@tak-ps/vue-tabler';
import LayerEnvironmentArcGIS from './LayerEnvironmentArcGIS.vue';
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

const emit = defineEmits([ 'layer' ]);

const raw = ref(false);
const alert = ref(false);
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
    for (const prop of Object.keys(props.capabilities.incoming.schema.output.properties)) {
        if (props.capabilities.incoming.schema.output.properties[prop].format && props.capabilities.incoming.schema.output.properties[prop].format === 'date-time') {
            return true;
        }
    }
    return false;
}

async function reload() {
    environment.value = JSON.parse(JSON.stringify(props.layer.incoming.environment));
    const cnf = JSON.parse(JSON.stringify(props.layer.incoming.config));

    if (!hasDateTime()) {
        delete cnf.timezone;
    } else if (!cnf.timezone) {
        cnf.timezone = { timezone: 'No TimeZone' }
    }

    config.value = cnf;

    disabled.value = true;
}

async function saveLayer() {
    loading.value.save = true;

    await std(`/api/connection/${props.layer.connection}/layer/${props.layer.id}/incoming`, {
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
