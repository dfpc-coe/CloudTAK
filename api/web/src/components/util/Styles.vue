<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Style Overrides</h3>

        <div class='ms-auto'>
            <div class='d-flex'>
                <span class='px-2'>Disable Overrides</span>
                <label class="form-check form-switch">
                    <input v-model='global_disable' class="form-check-input" type="checkbox" checked="">
                </label>
            </div>
        </div>
    </div>

    <div v-if='global_disable' class='card-body'>
        Style Overrides are disabled
    </div>
    <div v-else class='card-body'>
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


            <div class='col-md-6 mb-3'>
                <label class="form-label">Color Input</label>
                <div class="row g-2">
                    <div :key='color' v-for='color in [
                        "dark", "white", "blue", "azure", "indigo", "purple", "pink", "red", "orange", "yellow", "lime"
                    ]'
                    class="col-auto">
                        <label class="form-colorinput">
                            <input :disabled='disabled' v-model='filters[mode].color' :value='color' type="radio" class="form-colorinput-input">
                            <span class="form-colorinput-color bg-dark" :class='[
                                `bg-${color}`
                            ]'></span>
                        </label>
                    </div>
                </div>
            </div>
            <div class='col-md-6 mb-3'>
                <label class="form-label">Line Style</label>
                <select :disabled='disabled' v-model='filters[mode].style' class="form-select">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="outlined">Outlined</option>
                </select>
            </div>
            <div class='col-md-6 mb-3'>
                <label class="form-label">Line Thickness</label>
                <input :disabled='disabled' v-model='filters[mode].thickness' type="range" class="form-range mb-2" min="0" max="100" step="10">
            </div>
            <div class='col-md-6 mb-3'>
                <label class="form-label">Fill Opacity (Polygons)</label>
                <input :disabled='disabled' v-model='filters[mode].opacity' type="range" class="form-range mb-2" min="0" max="100" step="1">
            </div>
            <div class='col-md-12'>
                <TablerInput :disabled='disabled' v-model='filters[mode].remarks' label='Remarks'/>
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
    props: {
        modelValue: {
            type: Object,
            default: function() {
                return {};
            },
            required: true
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            mode: 'point',
            global_disable: true,
            filters: {
                point: {
                    style: 'solid',
                    color: 'red',
                    thickness: 0,
                    opacity: 0,
                    remarks: ''
                },
                line: {
                    style: 'solid',
                    color: 'red',
                    thickness: 0,
                    opacity: 0,
                    remarks: ''
                },
                polygon: {
                    style: 'solid',
                    color: 'red',
                    thickness: 0,
                    opacity: 0,
                    remarks: ''
                }
            }
        };
    },
    watch: {
        filters: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.filters);
            }
        }
    },
    mounted: function() {
        for (const key in this.modelValue) {
            Object.assign(this.filters[key], this.modelValue[key]);
        }

        this.$emit('update:modelValue', this.filters);
    },
    components: {
        TablerInput: Input,
        PointIcon,
        LineIcon,
        PolygonIcon
    }
}
</script>
