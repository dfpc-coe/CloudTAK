<template>
<div class='card'>
    <div class='card-body'>
        <div class='row'>
            <div class="d-flex justify-content-center mb-4">
                <div class="btn-list">
                    <div class="btn-group" role="group">
                        <input v-model='mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='point'>
                        <label @click='mode="point"' class="btn btn-icon px-3">
                            <PointIcon/> Points
                        </label>
                        <input v-model='mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='line'>
                        <label @click='mode="line"' class="btn btn-icon px-3">
                            <LineIcon/> Lines
                        </label>
                        <input v-model='mode' type="radio" class="btn-check" name="btn-radio-toolbar" value='polygon'>
                        <label @click='mode="polygon"' class="btn btn-icon px-3">
                            <PolygonIcon/> Polygons
                        </label>
                    </div>
                </div>
            </div>


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
                <input type="range" class="form-range mb-2" value="40" min="0" max="100" step="10">
            </div>
            <div class='col-md-6'>
                <label class="form-label">Fill Opacity (Polygons)</label>
                <input type="range" class="form-range mb-2" value="40" min="0" max="100" step="10">
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
import {
    PointIcon,
    LineIcon,
    PolygonIcon
} from 'vue-tabler-icons'

export default {
    name: 'StyleUtil',
    data: function() {
        return {
            mode: 'point',
            remarks: ''
        };
    },
    components: {
        TablerInput: Input,
        PointIcon,
        LineIcon,
        PolygonIcon
    }
}
</script>
