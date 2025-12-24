<template>
    <div
        class='d-flex align-items-center cursor-pointer user-select-none py-2 px-2 rounded transition-all mx-2'
        :class='{ "bg-accent": expanded, "hover": !expanded }'
        @click='toggle'
    >
        <slot name='icon' />
        <label class='subheader cursor-pointer m-0'>{{ label }}</label>

        <div class='ms-auto d-flex align-items-center'>
            <slot name='right' />
            <IconChevronDown
                class='transition-transform'
                :class='{ "rotate-180": !expanded }'
                :size='18'
            />
        </div>
    </div>

    <div
        class='grid-transition'
        :class='{ expanded: expanded }'
    >
        <div :style='{ overflow: overflow }'>
            <slot />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import { IconChevronDown } from '@tabler/icons-vue';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['update:modelValue']);

const expanded = ref(props.modelValue);

watch(() => props.modelValue, (val) => {
    expanded.value = val;
});

const overflow = ref('hidden');
let timeout: ReturnType<typeof setTimeout> | undefined;

watch(expanded, (val) => {
    if (timeout) clearTimeout(timeout);

    if (val) {
        timeout = setTimeout(() => {
            overflow.value = 'visible';
        }, 300);
    } else {
        overflow.value = 'hidden';
    }
});

function toggle() {
    expanded.value = !expanded.value;
    emit('update:modelValue', expanded.value);
}
</script>

<style scoped>
.grid-transition {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
}

.grid-transition.expanded {
    grid-template-rows: 1fr;
}

.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.3s ease-out;
}
</style>
