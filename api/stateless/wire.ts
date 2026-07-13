import RemoteHub from './hub/remote.js';
import type Config from '../common/config.js';

/**
 * Stateless (api) wiring. Attaches a RemoteHub that reaches the stateful hub
 * over HTTP RPC. No in-memory managers exist on this side.
 */
export default function wireRemote(config: Config, hubUrl: string): void {
    config.attach({
        hub: new RemoteHub(config, hubUrl),
    });
}
