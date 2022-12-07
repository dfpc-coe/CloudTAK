<template>
<div class='card'>
    <div class='card-body'>
        <div class='row'>
            <div class='col-md-6'>
                <label class="form-label">Color Input</label>
                <div class="row g-2">
                    <div :key='color' v-for='color in [
                        "dark", "white", "blue", "azure", "indigo", "purple", "pink", "red", "orange", "yellow", "lime"
                    ]'
                    class="col-auto">
                        <label class="form-colorinput">
                            <input name="color" type="radio" :value='color' class="form-colorinput-input">
                            <span class="form-colorinput-color bg-dark" :class='[
                                `bg-${color}`
                            ]'></span>
                        </label>
                    </div>
                </div>
            </div>
            <div class='col-md-6'>
                <label class="form-label">Line Thickness</label>
            </div>
            <div class='col-md-6'>
                <label class="form-label">Fill Opacity (Polygons)</label>
            </div>
            <div class='col-md-6'>
                <label class="form-label">Line Style</label>
                Solid, Dashed, Dotted, Outlined
            </div>
            <div class='col-md-12'>
                <TablerInput v-model='Remarks' label='Remarks'/>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    Input
} from '@tak-ps/vue-tabler'

export default {
    name: 'StyleUtil',
    data: function() {
        return {
            remarks: ''
        };
    },
    components: {
        TablerInput: Input
    }
}
</script>
