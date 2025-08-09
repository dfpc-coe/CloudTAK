import test from 'node:test';
import assert from 'node:assert';

// Test the exact icon conversion logic from the route
test('Icon path conversion - colon to slash', async () => {
    const feat = {
        properties: { icon: 'custom:icon:path' }
    };
    
    // This is the exact code from lines 87-90 in connection-layer-cot.ts
    if (feat.properties.icon && feat.properties.icon.includes(':')) {
        feat.properties.icon = feat.properties.icon.replace(':', '/');
    }
    
    assert.strictEqual(feat.properties.icon, 'custom/icon:path');
});

test('Icon path conversion - no colon', async () => {
    const feat = {
        properties: { icon: 'custom/icon/path' }
    };
    
    const originalIcon = feat.properties.icon;
    if (feat.properties.icon && feat.properties.icon.includes(':')) {
        feat.properties.icon = feat.properties.icon.replace(':', '/');
    }
    
    assert.strictEqual(feat.properties.icon, originalIcon);
});

test('Icon path conversion - no icon property', async () => {
    const feat = {
        properties: {}
    };
    
    if (feat.properties.icon && feat.properties.icon.includes(':')) {
        feat.properties.icon = feat.properties.icon.replace(':', '/');
    }
    
    assert.strictEqual(feat.properties.icon, undefined);
});

test('Icon path conversion - multiple colons', async () => {
    const feat = {
        properties: { icon: 'custom:icon:path:with:colons' }
    };
    
    if (feat.properties.icon && feat.properties.icon.includes(':')) {
        feat.properties.icon = feat.properties.icon.replace(':', '/');
    }
    
    assert.strictEqual(feat.properties.icon, 'custom/icon:path:with:colons');
});