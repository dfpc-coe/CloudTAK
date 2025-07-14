<template>
    <div
        tabindex='0'
        role='menuitem'
        class='cursor-pointer col-12 py-2 px-3 hover'
        :class='{
            "d-flex align-items-center": props.flex
        }'
    >
        <slot />
    </div>
</template>

<script setup lang='ts'>
const props = defineProps({
    flex: {
        type: Boolean,
        default: true
    }
});
</script>
