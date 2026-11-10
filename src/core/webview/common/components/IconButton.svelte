<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
interface Props {
    onclick?: (e: MouseEvent) => void;
    onClick?: (e: MouseEvent) => void;
    title: string;
    icon: string;
    contextData?: Record<string, unknown>;
    disabled?: boolean;
    className?: string;
    style?: string;
    ariaLabel?: string;
    tooltip?: string;
}

let {
    onclick,
    onClick,
    title,
    icon,
    contextData,
    disabled = false,
    className = '',
    style = '',
    ariaLabel,
    tooltip,
}: Props = $props();

let vscodeContext = $derived(contextData ? JSON.stringify(contextData) : undefined);
const tooltipId = $props.id();
let buttonElement: HTMLButtonElement | undefined = $state();
let tooltipElement: HTMLSpanElement | undefined = $state();
let tooltipTimer: ReturnType<typeof setTimeout> | undefined;

function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltipTimer = undefined;
    if (tooltipElement?.matches(':popover-open')) {
        tooltipElement.hidePopover();
    }
}

function handleTooltipKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        hideTooltip();
    }
}

function showTooltip() {
    if (!tooltipElement?.isConnected || !buttonElement?.isConnected || disabled) {
        return;
    }
    tooltipElement.showPopover();
    const button = buttonElement.getBoundingClientRect();
    const tip = tooltipElement.getBoundingClientRect();
    tooltipElement.style.left = `${Math.max(8, Math.min(button.left, window.innerWidth - tip.width - 8))}px`;
    tooltipElement.style.top = `${button.top - tip.height - 6 >= 8 ? button.top - tip.height - 6 : button.bottom + 6}px`;
}

function scheduleTooltip() {
    hideTooltip();
    if (tooltip && !disabled) {
        tooltipTimer = setTimeout(() => {
            tooltipTimer = undefined;
            showTooltip();
        }, 800);
    }
}

$effect(() => {
    if (!tooltip) {
        return;
    }
    document.addEventListener('scroll', hideTooltip, true);
    document.addEventListener('keydown', handleTooltipKeyDown);
    window.addEventListener('resize', hideTooltip);
    return () => {
        hideTooltip();
        document.removeEventListener('scroll', hideTooltip, true);
        document.removeEventListener('keydown', handleTooltipKeyDown);
        window.removeEventListener('resize', hideTooltip);
    };
});

function handleClick(e: MouseEvent) {
    hideTooltip();
    (onclick ?? onClick)?.(e);
}
</script>

<button
    bind:this={buttonElement}
    type="button"
    class="icon-button {className}"
    title={tooltip ? '' : title}
    aria-label={ariaLabel || title}
    aria-describedby={tooltip ? tooltipId : undefined}
    {disabled}
    {style}
    onclick={handleClick}
    onmouseenter={scheduleTooltip}
    onmouseleave={hideTooltip}
    onfocus={scheduleTooltip}
    onblur={hideTooltip}
    onpointerdown={hideTooltip}
    oncontextmenu={hideTooltip}
    onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
        }
    }}
    data-vscode-context={vscodeContext}
>
    <span aria-hidden="true" class="codicon {icon}"></span>
</button>

{#if tooltip}
    <span bind:this={tooltipElement} id={tooltipId} role="tooltip" popover="auto" class="action-tooltip">
        {tooltip}
    </span>
{/if}

<style>
    .icon-button:not(:disabled) {
        cursor: pointer;
    }

    .icon-button:disabled {
        cursor: default;
    }

    .icon-button:focus-visible {
        outline: 1px solid var(--vscode-focusBorder);
        outline-offset: -1px;
    }

    .action-tooltip {
        position: fixed;
        inset: auto;
        margin: 0;
        max-width: min(280px, calc(100vw - 16px));
        padding: 6px 8px;
        border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-editorGroupHeader-tabsBorder));
        border-radius: 4px;
        background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
        color: var(--vscode-editorHoverWidget-foreground, var(--vscode-foreground));
        font: 12px/1.4 var(--vscode-font-family);
        white-space: normal;
        pointer-events: none;
    }
</style>
