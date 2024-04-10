import { Static, Type } from '@sinclair/typebox'
import archiver, { Archiver } from 'archiver';
import CoT from '@tak-ps/node-cot';
import xmljs from 'xml-js';

export const Parameter = Type.Object({
    _attributes: Type.Object({
        name: Type.String(),
        value: Type.String()
    })
})

export const Manifest = Type.Object({
    MissionPackageManifest: Type.Object({
        _attributes: Type.Object({
            version: Type.String()
        }),
        Configuration: Type.Object({
            Parameter: Type.Array(Parameter)
        }),
        Contents: Type.Object({
            Content: Type.Array(Type.Object({
                _attributes: Type.Object({
                    ignore: Type.String(),
                    zipEntry: Type.String()
                }),
                Parameter: Type.Array(Parameter)
            }))
        })
    })
});

export default class DataPackage {
    writable: boolean;
    manifest: Static<typeof Manifest>;
    archive: Archiver;
    settings: {
        uid?: string;
        name?: string;
        onReceiveImport?: boolean;
        onReceiveDelete?: boolean;
    }

    constructor() {
        this.writable = true;
        this.archive = archiver('zip', { zlib: { level: 9 } });
        this.settings = {};
        this.manifest = {
            MissionPackageManifest: {
                _attributes: { version: '2' },
                Configuration: {
                    Parameter: []
                },
                Contents: {
                    Content: []
                }
            }
        };
    }

    addCoT(cot: CoT, opts: {
        ignore: boolean
    } = {
        ignore: false
    }) {
        const zipEntry = `${cot.raw.event._attributes.uid}/${cot.raw.event._attributes.uid}.cot`;
        this.archive.append(cot.to_xml(), {
            name: zipEntry
        });

        this.manifest.MissionPackageManifest.Contents.Content.push({
            _attributes: { ignore: String(opts.ignore), zipEntry },
            Parameter: [{
                _attributes: { name: 'uid', value: cot.raw.event._attributes.uid },
            },{
                _attributes: { name: 'name', value: cot.raw.event.detail.contact._attributes.callsign }
            }]
        });
    }

    finalize() {
        this.writable = false;

        for (const key in this.settings) {
            this.manifest.MissionPackageManifest.Configuration.Parameter.push({
                _attributes: { name: key, value: this.settings[key] }
            })
        }

        this.archive.append(xmljs.js2xml(this.manifest, { compact: true }), {
            name: 'MANIFEST/manifest.xml'
        });

        this.archive.finalize()
    }
}
