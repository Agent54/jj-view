<!--
  Copyright 2026 Google LLC
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
import Tooltip from './Tooltip.svelte';

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
let buttonElement: HTMLButtonElement | undefined = $state();
</script>

<button
    bind:this={buttonElement}
    type="button"
    class="icon-button {className}"
    title={tooltip ? '' : title}
    aria-label={ariaLabel || title}
    {disabled}
    {style}
    onclick={onclick ?? onClick}
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
    <Tooltip anchor={buttonElement} text={tooltip} {disabled} />
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

</style>
