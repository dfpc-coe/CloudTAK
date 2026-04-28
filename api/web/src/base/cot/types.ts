import type { Feature } from '../../types.ts';

export type COTUpdate = {
    path?: string;
    properties?: Feature['properties'];
    geometry?: Feature['geometry'];
}

export type COTMutationContext = {
    current: Feature;
    update: COTUpdate;
}

export type COTMutation = (context: COTMutationContext) => COTUpdate | undefined;
