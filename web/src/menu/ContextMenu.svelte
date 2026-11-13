<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
import { onMount } from 'svelte';
import type { ContextMenuPointerGesture, ResolvedMenuItemGroup } from './menu-types';

interface Props {
    x: number;
    y: number;
    groups: readonly ResolvedMenuItemGroup[];
    onSelect: (command: string) => void;
    onClose: () => void;
    openingPointer?: ContextMenuPointerGesture;
}

let { x, y, groups, onSelect, onClose, openingPointer }: Props = $props();

let menuEl: HTMLDivElement | null = $state(null);
// svelte-ignore state_referenced_locally
let posX = $state(x);
// svelte-ignore state_referenced_locally
let posY = $state(y);
let selected = false;

function selectCommand(command: string): void {
    if (selected) {
        return;
    }
    selected = true;
    onSelect(command);
    onClose();
}

$effect(() => {
    posX = x;
    posY = y;
    if (menuEl && typeof window !== 'undefined') {
        const rect = menuEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width - 8;
        const maxY = window.innerHeight - rect.height - 8;
        posX = Math.max(8, Math.min(x, maxX));
        posY = Math.max(8, Math.min(y, maxY));
    }
});

function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!menuEl) {
            return;
        }
        const buttons = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('button.menu-item'));
        if (buttons.length === 0) {
            return;
        }
        const activeIdx = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown') {
            const nextIdx = activeIdx < buttons.length - 1 ? activeIdx + 1 : 0;
            buttons[nextIdx].focus();
        } else {
            const prevIdx = activeIdx > 0 ? activeIdx - 1 : buttons.length - 1;
            buttons[prevIdx].focus();
        }
    }
}

function handleDismiss(e: Event): void {
    if (menuEl && !menuEl.contains(e.target as Node)) {
        onClose();
    }
}

onMount(() => {
    const gesture = openingPointer;
    let tracking = gesture !== undefined;
    let moved = false;

    function handlePointerMove(e: PointerEvent): void {
        if (tracking && gesture && e.pointerId === gesture.pointerId) {
            moved ||= Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) >= 4;
        }
    }

    function handlePointerUp(e: PointerEvent): void {
        if (!tracking || !gesture || e.pointerId !== gesture.pointerId || e.button !== gesture.button) {
            return;
        }
        tracking = false;
        // A simple right-click leaves the menu open, even if viewport clamping
        // placed an item underneath the original press location.
        if (!moved) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLButtonElement>('button.menu-item');
        const command = target?.dataset.command;
        if (target && command && menuEl?.contains(target)) {
            selectCommand(command);
        } else {
            onClose();
        }
    }

    function handlePointerCancel(e: PointerEvent): void {
        if (tracking && gesture && e.pointerId === gesture.pointerId) {
            tracking = false;
            onClose();
        }
    }

    window.addEventListener('pointerdown', handleDismiss, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointercancel', handlePointerCancel, { capture: true });
    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus the menu container
    menuEl?.focus();

    return () => {
        window.removeEventListener('pointerdown', handleDismiss, { capture: true });
        window.removeEventListener('pointermove', handlePointerMove, { capture: true });
        window.removeEventListener('pointerup', handlePointerUp, { capture: true });
        window.removeEventListener('pointercancel', handlePointerCancel, { capture: true });
        window.removeEventListener('keydown', handleKeyDown);
    };
});
</script>

<div
    bind:this={menuEl}
    class="context-menu"
    data-testid="context-menu"
    role="menu"
    tabindex="-1"
    style={`left: ${posX}px; top: ${posY}px;`}
    oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
    }}
>
    {#each groups as group, groupIdx (group.groupName)}
        {#if groupIdx > 0}
            <div class="menu-separator" role="separator"></div>
        {/if}
        {#each group.items as item (item.command)}
            <button
                type="button"
                class="menu-item"
                role="menuitem"
                data-testid={`menu-item-${item.command}`}
                data-command={item.command}
                onclick={() => selectCommand(item.command)}
            >
                <span class="item-icon">
                    {#if item.iconClass}
                        <i class={item.iconClass} aria-hidden="true"></i>
                    {/if}
                </span>
                <span class="item-title">{item.title}</span>
            </button>
        {/each}
    {/each}
</div>

<style>
.context-menu {
    position: fixed;
    z-index: 2500;
    min-width: 180px;
    max-width: 320px;
    background-color: var(--vscode-menu-background, var(--vscode-editor-background));
    color: var(--vscode-menu-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-menu-border, var(--vscode-widget-border, var(--vscode-editorGroupHeader-tabsBorder)));
    border-radius: 6px;
    box-shadow: 0 4px 16px var(--vscode-widget-shadow, color-mix(in srgb, var(--vscode-foreground) 20%, transparent));
    padding: 4px 0;
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    user-select: none;
    outline: none;
}

.menu-separator {
    height: 1px;
    background-color: var(--vscode-menu-separatorBackground, var(--vscode-editorGroupHeader-tabsBorder));
    margin: 4px 0;
}

.menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: inherit;
    font-family: inherit;
    font-size: inherit;
    text-align: left;
    cursor: pointer;
    outline: none;
    gap: 8px;
    box-sizing: border-box;
}

.menu-item:hover,
.menu-item:focus {
    background-color: var(--vscode-menu-selectionBackground, var(--vscode-list-activeSelectionBackground));
    color: var(--vscode-menu-selectionForeground, var(--vscode-list-activeSelectionForeground));
}

.item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    font-size: 14px;
}

.item-title {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
