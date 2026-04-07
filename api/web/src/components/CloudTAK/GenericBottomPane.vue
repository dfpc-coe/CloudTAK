<template>
    <div class='generic-bottom-pane'>
        <slot />
    </div>
</template>

<script setup lang="ts"></script>

<style scoped>
/*
 * GenericBottomPane
 *
 * A wrapper that positions content at the bottom-centre of the map, always
 * floating above the persistent bottom status bar.
 */
.generic-bottom-pane {
    position: absolute;
    z-index: 5;
    bottom: calc(var(--map-bottom-bar-size, 50px) + 8px);
    left: calc(50% - 250px);
    width: 500px;
}

.generic-bottom-pane :deep(.card) {
    border-bottom-left-radius: var(--tblr-card-border-radius, 0.375rem);
    border-bottom-right-radius: var(--tblr-card-border-radius, 0.375rem);
}

@media (max-width: 600px) {
    .generic-bottom-pane {
        left: 8px;
        right: 8px;
        width: auto;
    }
}
</style>
