<template>
    <div>
        <div class='d-flex align-items-center pb-1'>
            <label class='subheader user-select-none m-0'>Affiliation</label>

            <TablerDropdown
                :width='300'
                class='ms-auto'
            >
                <button
                    type='button'
                    class='btn btn-sm btn-ghost-secondary d-inline-flex align-items-center gap-1 px-2'
                    :class='{ "text-primary": selected && !selected.primary }'
                >
                    <span v-text='menuLabel' />
                    <IconChevronDown
                        :size='14'
                        stroke='1.5'
                    />
                </button>

                <template #dropdown>
                    <div class='py-1'>
                        <template
                            v-for='group of groups'
                            :key='group.label'
                        >
                            <div
                                class='dropdown-header text-uppercase'
                                v-text='group.label'
                            />
                            <button
                                v-for='aff of group.items'
                                :key='aff.code'
                                type='button'
                                class='dropdown-item d-flex align-items-center py-2'
                                :class='{ active: aff.code === modelValue }'
                                @click='emit("update:modelValue", aff.code)'
                            >
                                <AffiliationFrame
                                    class='me-2'
                                    :family='aff.family'
                                    :code='aff.code'
                                    :size='18'
                                />
                                <span class='d-flex flex-column text-start'>
                                    <span v-text='aff.label' />
                                    <span
                                        class='text-secondary small'
                                        v-text='aff.meaning'
                                    />
                                </span>
                            </button>
                        </template>

                        <template v-if='context !== undefined'>
                            <div class='dropdown-header text-uppercase'>
                                Context
                            </div>
                            <button
                                v-for='opt of CONTEXT_OPTIONS'
                                :key='opt.value'
                                type='button'
                                class='dropdown-item d-flex align-items-center py-2'
                                :class='{ active: opt.value === context }'
                                @click='emit("update:context", opt.value)'
                            >
                                <IconCheck
                                    :size='16'
                                    stroke='2'
                                    class='me-2'
                                    :style='{ visibility: opt.value === context ? "visible" : "hidden" }'
                                />
                                <span class='d-flex flex-column text-start'>
                                    <span v-text='opt.label' />
                                    <span
                                        class='text-secondary small'
                                        v-text='opt.meaning'
                                    />
                                </span>
                            </button>
                        </template>
                    </div>
                </template>
            </TablerDropdown>
        </div>

        <div
            class='affiliation-chips d-flex align-items-center gap-1 rounded p-1'
            role='radiogroup'
        >
            <button
                v-for='aff of chips'
                :key='aff.code'
                type='button'
                role='radio'
                class='affiliation-chip btn btn-sm flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1 px-2'
                :class='{ active: aff.code === modelValue }'
                :style='{ "--affiliation-color": FAMILY_COLORS[aff.family] }'
                :aria-checked='aff.code === modelValue'
                @click='emit("update:modelValue", aff.code)'
            >
                <AffiliationFrame
                    :family='aff.family'
                    :code='aff.code'
                    :size='20'
                />
                <span
                    class='text-truncate'
                    v-text='aff.label'
                />
            </button>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { IconCheck, IconChevronDown } from '@tabler/icons-vue';
import { TablerDropdown } from '@tak-ps/vue-tabler';
import AffiliationFrame from './AffiliationFrame.vue';
import { AFFILIATIONS, FAMILY_COLORS, CONTEXT_OPTIONS, affiliation } from '../../../utils/appearance.ts';
import type { Affiliation } from '../../../utils/appearance.ts';

const props = defineProps<{
    modelValue: string;
    /** 2525E context digit - unset for types that cannot carry one */
    context?: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', code: string): void;
    (e: 'update:context', context: string): void;
}>();

const selected = computed<Affiliation | undefined>(() => affiliation(props.modelValue));

const menuLabel = computed<string>(() => {
    const parts: string[] = [];
    if (selected.value && !selected.value.primary) parts.push(selected.value.label);

    const context = CONTEXT_OPTIONS.find((opt) => opt.value === props.context);
    if (context && context.value !== '0') parts.push(context.label);

    return parts.length ? parts.join(' · ') : 'More affiliations';
});

// A rarer affiliation joins the row while it is the selection
const chips = computed<Affiliation[]>(() => {
    const primary = AFFILIATIONS.filter((aff) => aff.primary);
    if (selected.value && !selected.value.primary) primary.push(selected.value);
    return primary;
});

const groups = computed(() => {
    const more = AFFILIATIONS.filter((aff) => !aff.primary);

    return [
        { label: 'Friendly family', items: more.filter((aff) => aff.family === 'friendly') },
        { label: 'Hostile family', items: more.filter((aff) => aff.family === 'hostile') },
        { label: 'Other', items: more.filter((aff) => aff.family === 'other') },
    ].filter((group) => group.items.length);
});
</script>

<style scoped>
.affiliation-chips {
    background: light-dark(var(--tblr-gray-100), var(--tblr-gray-900));
    border: 1px solid var(--tblr-border-color-translucent);
}

.affiliation-chip {
    min-width: 0;
    border: 1px solid transparent;
    background: transparent;
    color: var(--tblr-secondary);
}

.affiliation-chip:hover {
    color: var(--tblr-body-color);
}

.affiliation-chip.active {
    color: var(--tblr-body-color);
    font-weight: 500;
    background: var(--tblr-bg-surface);
    border-color: color-mix(in srgb, var(--affiliation-color) 55%, var(--tblr-body-color));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}
</style>
