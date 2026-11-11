/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { mount, unmount } from 'svelte';
import Tooltip from './components/Tooltip.svelte';

/** Attach the shared tooltip without wrapping or replacing the existing control. */
export function tooltip(anchor: HTMLElement, text: string | undefined) {
    const props = $state({ anchor, text: text ?? '' });
    const instance = mount(Tooltip, { target: anchor.ownerDocument.body, props });

    return {
        update(value: string | undefined): void {
            props.text = value ?? '';
        },
        destroy(): void {
            void unmount(instance);
        },
    };
}
