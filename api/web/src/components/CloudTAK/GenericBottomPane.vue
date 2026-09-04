<template>
    <div class='generic-bottom-pane'>
        <slot />
    </div>
</template>

<script setup lang="ts"></script>

<style scoped>
/* Positions content at the bottom-centre of the map. */
.generic-bottom-pane {
    position: absolute;
    z-index: 5;
    bottom: calc(8px + var(--map-bottom-inset, 0px));
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
