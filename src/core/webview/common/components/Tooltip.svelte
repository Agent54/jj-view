<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
import type { Snippet } from 'svelte';
import { tooltipTiming } from '../tooltip-timing';

interface Props {
    anchor?: HTMLElement;
    text: string;
    heading?: string;
    accentColor?: string;
    badges?: Snippet;
    disabled?: boolean;
    multiline?: boolean;
    ignoreSelector?: string;
}

let { anchor, text, heading, accentColor, badges, disabled = false, multiline = false, ignoreSelector }: Props = $props();
const tooltipId = $props.id();
let tooltipElement: HTMLDivElement | undefined = $state();
// Live text updates must not detach hover listeners or cancel the pending timer.
const hasText = $derived(Boolean(text));

$effect(() => {
    const target = anchor;
    const tip = tooltipElement;
    const ignored = ignoreSelector;
    const usePointerPosition = multiline;
    if (!target || !tip || disabled || !hasText) {
        return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hovering = false;
    let pointerX: number | undefined;
    const previousDescription = target.getAttribute('aria-describedby');
    target.setAttribute('aria-describedby', [previousDescription, tooltipId].filter(Boolean).join(' '));

    function hide(): void {
        clearTimeout(timer);
        timer = undefined;
        if (tip?.matches(':popover-open')) {
            tip.hidePopover();
        }
        tooltipTiming.hidden(hide);
    }

    function show(): void {
        timer = undefined;
        if (!target?.isConnected || !tip?.isConnected) {
            return;
        }
        tooltipTiming.shown(hide);
        tip.showPopover();
        const rect = target.getBoundingClientRect();
        const bounds = tip.getBoundingClientRect();
        const x = usePointerPosition && pointerX !== undefined ? pointerX : rect.left;
        tip.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`;
        tip.style.top = `${rect.top - bounds.height - 6 >= 8 ? rect.top - bounds.height - 6 : rect.bottom + 6}px`;
    }

    function schedule(): void {
        if (tip?.matches(':popover-open') || timer !== undefined) {
            return;
        }
        if (tooltipTiming.delay === 0) {
            show();
        } else {
            timer = setTimeout(show, tooltipTiming.delay);
        }
    }

    function onPointerOver(event: PointerEvent): void {
        if (event.pointerType === 'touch' || event.buttons ||
            (ignored && event.target instanceof Element && event.target.closest(ignored))) {
            hovering = false;
            hide();
            return;
        }
        pointerX = event.clientX;
        if (!hovering) {
            hovering = true;
            schedule();
        }
    }

    function onPointerLeave(): void {
        hovering = false;
        hide();
    }

    function onFocus(event: FocusEvent): void {
        if (event.target === target) {
            pointerX = undefined;
            schedule();
        }
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            hide();
        }
    }

    target.addEventListener('pointerover', onPointerOver);
    target.addEventListener('pointerleave', onPointerLeave);
    target.addEventListener('focus', onFocus);
    target.addEventListener('blur', hide);
    target.addEventListener('pointerdown', hide);
    target.addEventListener('contextmenu', hide);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', hide);
    return () => {
        hide();
        target.removeEventListener('pointerover', onPointerOver);
        target.removeEventListener('pointerleave', onPointerLeave);
        target.removeEventListener('focus', onFocus);
        target.removeEventListener('blur', hide);
        target.removeEventListener('pointerdown', hide);
        target.removeEventListener('contextmenu', hide);
        document.removeEventListener('scroll', hide, true);
        document.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('resize', hide);
        if (previousDescription === null) {
            target.removeAttribute('aria-describedby');
        } else {
            target.setAttribute('aria-describedby', previousDescription);
        }
    };
});
</script>

<div
    bind:this={tooltipElement}
    id={tooltipId}
    role="tooltip"
    popover="manual"
    class="tooltip"
    class:multiline
    style:--tooltip-accent={accentColor}
>
    {#if heading}
        <strong class="tooltip-heading" class:badge={Boolean(accentColor)}>{heading}</strong>
    {/if}
    {#if badges}
        <div class="tooltip-badges">{@render badges()}</div>
    {/if}
    {text}
</div>

<style>
    .tooltip {
        position: fixed;
        inset: auto;
        margin: 0;
        max-width: min(280px, calc(100vw - 16px));
        max-height: calc(100vh - 16px);
        overflow: hidden;
        padding: 6px 8px;
        border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-editorGroupHeader-tabsBorder));
        border-radius: 6px;
        background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
        color: var(--vscode-editorHoverWidget-foreground, var(--vscode-foreground));
        font: var(--vscode-font-size, 13px)/1.5 var(--vscode-font-family);
        white-space: normal;
        overflow-wrap: anywhere;
        pointer-events: none;
        user-select: none;
    }

    .tooltip-heading {
        display: block;
        margin-bottom: 4px;
        color: var(--tooltip-accent, inherit);
        font-weight: 600;
    }

    .tooltip-badges {
        display: flex;
        gap: 4px;
        margin-bottom: 4px;
    }

    .tooltip-heading.badge {
        display: flex;
        align-items: center;
        width: fit-content;
        height: 18px;
        box-sizing: border-box;
        padding: 0 3px;
        border: 1px solid var(--vscode-jjView-currentCommit-background, color-mix(in srgb, var(--tooltip-accent), transparent 50%));
        border-radius: 4px;
        background: var(--vscode-jjView-currentCommit-background, color-mix(in srgb, var(--tooltip-accent), transparent 90%));
        color: var(--vscode-jjView-currentCommit-foreground, var(--tooltip-accent));
        font-size: calc(var(--vscode-font-size, 13px) - 2px);
        font-weight: normal;
        line-height: normal;
    }

    .multiline {
        max-width: min(440px, calc(100vw - 16px));
        padding: 10px 12px;
        font-size: max(14px, var(--vscode-font-size, 13px));
        white-space: pre-line;
    }
</style>
