<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Core Features
            </h3>
        </div>
        <div class='card-body'>
            <TablerNone
                label='No Core Features'
                :create='false'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import {
    TablerNone,
} from '@tak-ps/vue-tabler'
</script>
