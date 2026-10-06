<template>
    <CollapsibleCard
        label='Infrastructure'
        :summary='summary'
    >
        <template #icon>
            <IconServer
                :size='32'
                stroke='1'
                class='text-muted'
            />
        </template>

        <div class='row g-2'>
            <div class='col-md-6'>
                <TablerInput
                    v-model='infra.memory'
                    label='Memory (Mb)'
                    :disabled='disabled'
                    type='number'
                    min='1'
                    step='1'
                />
            </div>
            <div class='col-md-6'>
                <TablerInput
                    v-model='infra.timeout'
                    label='Timeout (s)'
                    :disabled='disabled'
                    type='number'
                    min='1'
                    step='1'
                />
            </div>
            <div class='col-md-12'>
                <TablerToggle
                    v-model='infra.vpc'
                    label='Private Network Access'
                    :description='vpcDescription'
                    :disabled='disabled || !systemAdmin || (!vpcConfig.enabled && !infra.vpc)'
                />
            </div>
            <div
                v-if='infra.vpc && vpcConfig.addresses.length'
                class='col-md-12'
            >
                <div class='text-muted small mb-1'>
                    Static Egress Addresses
                </div>
                <div class='d-flex flex-wrap gap-2'>
                    <code
                        v-for='address in vpcConfig.addresses'
                        :key='address'
                        class='px-2 py-1 border rounded'
                        v-text='address'
                    />
                </div>
            </div>
        </div>
    </CollapsibleCard>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import type { ETLLayer } from '../../types.ts';
import { IconServer } from '@tabler/icons-vue';
import CollapsibleCard from './CollapsibleCard.vue';
import { TablerInput, TablerToggle } from '@tak-ps/vue-tabler';
import { server } from '../../std.ts';
import ProfileConfig from '../../base/profile.ts';

type InfraConfig = Pick<ETLLayer, 'memory' | 'timeout' | 'vpc'>;

const props = withDefaults(defineProps<{
    modelValue: ETLLayer;
    disabled?: boolean;
}>(), {
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: ETLLayer): void;
}>();

const infra = ref<InfraConfig>(fromLayer(props.modelValue));
const systemAdmin = ref(false);
const vpcConfig = ref<{ enabled: boolean; addresses: string[] }>({ enabled: false, addresses: [] });

const summary = computed(() => {
    const base = `${infra.value.memory} Mb Memory - ${infra.value.timeout}s Timeout`;
    return infra.value.vpc ? `${base} - Private Network` : base;
});

const vpcDescription = computed(() => {
    const base = 'Run inside the private network so requests leave from the static addresses below and internal resources are reachable.';
    if (systemAdmin.value) return `${base} Grants a higher degree of trust to this ETL.`;
    return `${base} Only a System Administrator can change this setting.`;
});

onMounted(async () => {
    const admin = await ProfileConfig.get('system_admin');
    if (admin) {
        systemAdmin.value = !!admin.value;
    } else {
        try {
            systemAdmin.value = !!(await ProfileConfig.fetch()).system_admin;
        } catch (err) {
            console.error('Failed to fetch Profile', err);
        }
    }

    const { data, error } = await server.GET('/api/config/vpc');
    if (error) throw new Error(String(error));
    vpcConfig.value = data;
});

watch(() => props.modelValue, (layer) => {
    const next = fromLayer(layer);
    if (JSON.stringify(next) !== JSON.stringify(infra.value)) {
        infra.value = next;
    }
}, {
    deep: true
});

watch(infra, () => {
    emit('update:modelValue', {
        ...props.modelValue,
        memory: Number(infra.value.memory),
        timeout: Number(infra.value.timeout),
        vpc: infra.value.vpc,
    });
}, {
    deep: true
});

function fromLayer(layer: ETLLayer): InfraConfig {
    return {
        memory: layer.memory,
        timeout: layer.timeout,
        vpc: layer.vpc,
    };
}
</script>
