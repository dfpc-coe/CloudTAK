<template>
    <div class='generic-bottom-pane'>
        <slot />
    </div>
</template>

<style scoped>
/*
 * GenericBottomPane
 *
 * A wrapper that positions content at the bottom-centre of the map. On small
 * screens (≤ 600 px) it is raised 40 px from the bottom so that it clears the
 * callsign / location bar that sits flush at bottom-left.
 */
.generic-bottom-pane {
    position: absolute;
    z-index: 2;
    bottom: 0;
    left: calc(50% - 250px);
    width: 500px;
}

/* On desktop the pane sits flush against the bottom edge — square off the
   bottom corners of any card rendered inside it. */
.generic-bottom-pane :deep(.card) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
}

@media (max-width: 600px) {
    .generic-bottom-pane {
        bottom: calc(40px + 8px);
        left: 8px;
        right: 8px;
        width: auto;
    }

    /* Restore card border-radius on mobile since it floats above the bottom bar */
    .generic-bottom-pane :deep(.card) {
        border-bottom-left-radius: var(--tblr-card-border-radius, 0.375rem);
        border-bottom-right-radius: var(--tblr-card-border-radius, 0.375rem);
    }
}
</style>
