<template>
    <div class='col-12'>
        <IconLabel
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label
            class='subheader user-select-none'
            v-text='label'
        />
        <div class='mx-2'>
            <CopyField
                :model-value='inMode'
                :edit='edit && config.mode === "dd"'
                :hover='hover && config.mode === "dd"'
                :validate='validateInput'
                :size='24'
                @update:model-value='coordinateEntry($event)'
            />
            <template v-if='modes.length'>
                <div
                    role='menu'
                    class='mx-2'
                >
                    <span
                        v-if='modes.includes("dd")'
                        v-tooltip='"Decimal Degrees"'
                        role='menuitem'
                        tabindex='0'
                        class='my-1 px-2 user-select-none'
                        :class='{
                            "bg-accent rounded-bottom text-blue": config.mode === "dd",
                            "cursor-pointer": config.mode !== "dd",
                        }'
                        @click='config.mode = "dd"'
                    >DD</span>
                    <span
                        v-if='modes.includes("dms")'
                        v-tooltip='"Decimal Minutes Seconds"'
                        class='my-1 px-2 user-select-none'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-accent rounded-bottom text-blue": config.mode === "dms",
                            "cursor-pointer": config.mode !== "dms",
                        }'
                        @click='config.mode = "dms"'
                    >DMS</span>
                    <span
                        v-if='modes.includes("mgrs")'
                        v-tooltip='"Military Grid Reference System"'
                        class='my-1 px-2 user-select-none'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-accent rounded-bottom text-blue": config.mode === "mgrs",
                            "cursor-pointer": config.mode !== "mgrs",
                        }'
                        @click='config.mode = "mgrs"'
                    >MGRS</span>
                    <span
                        v-if='modes.includes("utm")'
                        v-tooltip='"Universal Transverse Mercator"'
                        class='my-1 px-2 user-select-none'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-accent rounded-bottom text-blue": config.mode === "utm",
                            "cursor-pointer": config.mode !== "utm",
                        }'
                        @click='config.mode = "utm"'
                    >UTM</span>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import CopyField from './CopyField.vue';
import { validateLatLng } from '../../../base/validators.ts';
import {
    IconLabel
} from '@tabler/icons-vue';
import { ref, computed } from 'vue';

const props = defineProps({
    label: {
        type: String,
        default: 'Coordinates'
    },
    hover: {
        type: Boolean,
        default: false
    },
    edit: {
        type: Boolean,
        default: false
    },
    truncate: {
        type: Number,
        description: 'Truncate DD coordinates to a given precision'
    },
    modes: {
        type: Array,
        default: function() {
            return ['dd', 'dms', 'mgrs', 'utm']
        }
    },
    modelValue: {
        type: Array,
        required: true,
        description: 'A coordinate pair in GeoJSON format (lng,lat)'
    }
});

const emit = defineEmits([
    'update:modelValue',
]);

const config = ref({
    mode: 'dd'
})

const validateInput = computed(() => {
    return (text: string): boolean | string => {
        if (config.value.mode === 'dd') {
            return validateLatLng(text);
        } else {
            return false;
        }
    }
});

const inMode = computed(() => {
    if (config.value.mode === 'dd') {
        if (props.truncate) {
            return [
                Math.trunc(props.modelValue[1] as number * Math.pow(10, props.truncate)) / Math.pow(10, props.truncate),
                Math.trunc(props.modelValue[0] as number * Math.pow(10, props.truncate)) / Math.pow(10, props.truncate)
            ].join(', ');
        } else {
            return `${props.modelValue[1]}, ${props.modelValue[0]}`;
        }
    } else if (config.value.mode === 'dms') {
        return `${asDMS(props.modelValue[1] as number)}, ${asDMS(props.modelValue[0] as number)}`;
    } else if (config.value.mode === 'mgrs') {
        return asMGRS();
    } else if (config.value.mode === 'utm') {
        return asUTM(
            props.modelValue[1] as number,
            props.modelValue[0] as number
        );
    }

    return 'UNKNOWN'
});

function coordinateEntry(text: string) {
    emit('update:modelValue',
        text
            .split(',')
            .map((c) => Number(c.trim()))
            .reverse()
    );
}

function asDMS(dd: number): string {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    const sec = (abs - deg - min / 60) * 3600;
    return (dd < 0 ? '-' : '') + deg + '° ' + min + '\' ' + Math.floor(sec * 100) / 100 + '"';
}

function asUTM(latitude: number, longitude: number) {
    const K0 = 0.9996;
    const E = 0.00669438;
    const E_P2 = E / (1 - E);
    const E2 = Math.pow(E, 2);
    const E3 = Math.pow(E, 3);
    const R = 6378137;

    const M1 = 1 - E / 4 - 3 * E2 / 64 - 5 * E3 / 256;
    const M2 = 3 * E / 8 + 3 * E2 / 32 + 45 * E3 / 1024;
    const M3 = 15 * E2 / 256 + 45 * E3 / 1024;
    var M4 = 35 * E3 / 3072;

    const latRad = toRadians(latitude);
    const latSin = Math.sin(latRad);
    const latCos = Math.cos(latRad);

    const latTan = Math.tan(latRad);
    const latTan2 = Math.pow(latTan, 2);
    const latTan4 = Math.pow(latTan, 4);

    const zoneNum = latLonToZoneNumber(latitude, longitude);

    const zoneLetter = latitudeToZoneLetter(latitude);

    const lonRad = toRadians(longitude);
    const centralLon = zoneNumberToCentralLongitude(zoneNum);
    const centralLonRad = toRadians(centralLon);

    const n = R / Math.sqrt(1 - E * latSin * latSin);
    const c = E_P2 * latCos * latCos;

    const a = latCos * (lonRad - centralLonRad);
    const a2 = Math.pow(a, 2);
    const a3 = Math.pow(a, 3);
    const a4 = Math.pow(a, 4);
    const a5 = Math.pow(a, 5);
    const a6 = Math.pow(a, 6);

    const m = R * (M1 * latRad -
        M2 * Math.sin(2 * latRad) +
        M3 * Math.sin(4 * latRad) -
        M4 * Math.sin(6 * latRad));
    const easting = K0 * n * (a +
        a3 / 6 * (1 - latTan2 + c) +
        a5 / 120 * (5 - 18 * latTan2 + latTan4 + 72 * c - 58 * E_P2)) + 500000;
    let northing = K0 * (m + n * latTan * (a2 / 2 +
        a4 / 24 * (5 - latTan2 + 9 * c + 4 * c * c) +
        a6 / 720 * (61 - 58 * latTan2 + latTan4 + 600 * c - 330 * E_P2)));
    if (latitude < 0) northing += 1e7;

    return `${zoneNum}${zoneLetter} ${Math.floor(easting)} ${Math.floor(northing)}`;
}

function zoneNumberToCentralLongitude(zoneNum: number) {
    return (zoneNum - 1) * 6 - 180 + 3;
}

function toRadians(deg: number) {
    return deg * Math.PI / 180;
}

function latitudeToZoneLetter(latitude: number) {
    const ZONE_LETTERS = 'CDEFGHJKLMNPQRSTUVWXX';
    if (-80 <= latitude && latitude <= 84) {
        return ZONE_LETTERS[Math.floor((latitude + 80) / 8)];
    } else {
        return null;
    }
}

function latLonToZoneNumber(latitude: number, longitude: number) {
    if (56 <= latitude && latitude < 64 && 3 <= longitude && longitude < 12) return 32;

    if (72 <= latitude && latitude <= 84 && longitude >= 0) {
        if (longitude <  9) return 31;
        if (longitude < 21) return 33;
        if (longitude < 33) return 35;
        if (longitude < 42) return 37;
    }

    return Math.floor((longitude + 180) / 6) + 1;
}

function asMGRS() {
    const Lat = props.modelValue[1] as number;
    const Long = props.modelValue[0] as number;
    if (Lat < -80) return 'Too far South';
    if (Lat > 84) return 'Too far North' ;
    const c = 1 + Math.floor ((Long+180)/6);
    const e = c*6 - 183 ;
    const k = Lat*Math.PI/180;
    const l = Long*Math.PI/180;
    const m = e*Math.PI/180;
    const n = Math.cos (k);
    const o = 0.006739496819936062*Math.pow (n,2);
    const p = 40680631590769/(6356752.314*Math.sqrt(1 + o));
    const q = Math.tan (k);
    const r = q*q;
    const t = l - m;
    const u = 1.0 - r + o;
    const v = 5.0 - r + 9*o + 4.0*(o*o);
    const w = 5.0 - 18.0*r + (r*r) + 14.0*o - 58.0*r*o;
    const x = 61.0 - 58.0*r + (r*r) + 270.0*o - 330.0*r*o;
    const y = 61.0 - 479.0*r + 179.0*(r*r) - (r*r*r);
    const z = 1385.0 - 3111.0*r + 543.0*(r*r) - (r*r*r);
    let aa = p*n*t + (p/6.0*Math.pow (n,3)*u*Math.pow (t,3)) + (p/120.0*Math.pow (n,5)*w*Math.pow (t,5)) + (p/5040.0*Math.pow (n,7)*y*Math.pow (t,7));
    let ab = 6367449.14570093*(k - (0.00251882794504*Math.sin (2*k)) + (0.00000264354112*Math.sin (4*k)) - (0.00000000345262*Math.sin (6*k)) + (0.000000000004892*Math.sin (8*k))) + (q/2.0*p*Math.pow (n,2)*Math.pow (t,2)) + (q/24.0*p*Math.pow (n,4)*v*Math.pow (t,4)) + (q/720.0*p*Math.pow (n,6)*x*Math.pow (t,6)) + (q/40320.0*p*Math.pow (n,8)*z*Math.pow (t,8));
    aa = aa*0.9996 + 500000.0;
    ab = ab*0.9996; if (ab < 0.0) ab += 10000000.0;
    const ad = 'CDEFGHJKLMNPQRSTUVWXX'.charAt (Math.floor (Lat/8 + 10));
    const ae = Math.floor (aa/100000);
    const af = ['ABCDEFGH','JKLMNPQR','STUVWXYZ'][(c-1)%3].charAt (ae-1);
    const ag = Math.floor (ab/100000)%20;
    const ah = ['ABCDEFGHJKLMNPQRSTUV','FGHJKLMNPQRSTUVABCDE'][(c-1)%2].charAt (ag);

    function pad (val: number): string {
        if (val < 10) {
            return '0000' + val
        } else if (val < 100) {
            return '000' + val
        } else if (val < 1000) {
            return '00' + val
        } else if (val < 10000) {
            return '0' + val
        }

        return String(val);
    }

    aa = Math.floor(aa % 100000);
    ab = Math.floor(ab % 100000);
    return c + ad + ' ' + af + ah + ' ' + pad(aa) + ' ' + pad(ab);
}
</script>
