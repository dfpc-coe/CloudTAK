<template>
    <div>
        <template v-if='editing'>
            <GroupSelect
                :model-value='modelValue'
                :active='active'
                :direction='direction'
                :limit='limit'
                @update:model-value='emit("update:modelValue", $event)'
            />

            <div class='d-flex justify-content-end gap-2 pt-2'>
                <TablerButton
                    :disabled='saving'
                    @click.stop='emit("cancel")'
                >
                    Cancel
                </TablerButton>
                <TablerButton
                    class='btn-primary'
                    :disabled='saving'
                    @click.stop='emit("save")'
                >
                    {{ saving ? savingLabel : saveLabel }}
                </TablerButton>
            </div>
        </template>

        <template v-else>
            <div
                v-if='value.length'
                class='d-flex flex-wrap gap-2'
            >
                <TablerBadge
                    v-for='group of value'
                    :key='group'
                    :class='badgeClass'
                    :background-color='badgeBackgroundColor'
                    :border-color='badgeBorderColor'
                    :text-color='badgeTextColor'
                >
                    {{ group }}
                </TablerBadge>
            </div>
            <p
                v-else
                :class='emptyClass'
            >
                {{ emptyLabel }}
            </p>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { TablerBadge, TablerButton } from '@tak-ps/vue-tabler';
import GroupSelect from './GroupSelect.vue';

withDefaults(defineProps<{
    value: string[];
    modelValue: string[];
    editing: boolean;
    active?: boolean;
    direction?: string;
    limit?: number;
    saving?: boolean;
    saveLabel?: string;
    savingLabel?: string;
    emptyLabel?: string;
    emptyClass?: string;
    badgeClass?: string;
    badgeBackgroundColor?: string;
    badgeBorderColor?: string;
    badgeTextColor?: string;
}>(), {
    active: true,
    direction: 'IN',
    limit: undefined,
    saving: false,
    saveLabel: 'Save',
    savingLabel: 'Saving...',
    emptyLabel: 'None',
    emptyClass: 'text-white-50 mb-0',
    badgeClass: 'rounded-pill text-uppercase fw-semibold',
    badgeBackgroundColor: 'rgba(107, 114, 128, 0.2)',
    badgeBorderColor: 'rgba(107, 114, 128, 0.5)',
    badgeTextColor: '#d1d5db'
});

const emit = defineEmits<{
    'update:modelValue': [value: string[]];
    cancel: [];
    save: [];
}>();
</script>