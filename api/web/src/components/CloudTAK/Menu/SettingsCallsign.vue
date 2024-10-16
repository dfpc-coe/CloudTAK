<template>
    <MenuTemplate name='Callsign &amp; Device'>
        <div class='mx-2'>
            <SettingsCallsign />
        </div>
    </MenuTemplate>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import SettingsCallsign from '../util/SettingsCallsign.vue';

export default {
    name: 'CloudTAKSettingsCallsign',
    components: {
        MenuTemplate,
        SettingsCallsign
    },
}
</script>
