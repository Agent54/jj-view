/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { CommandContext } from '../host/command-context';
import { showJjError } from '../host/ui-helpers';

export interface CopyChangeIdPayload {
    revision?: string;
}

export async function copyChangeIdCommand(ctx: CommandContext, payload?: CopyChangeIdPayload): Promise<void> {
    const revision = payload?.revision ?? '@';
    try {
        const entry = await ctx.repo.jj.getLogEntry(revision);
        if (!entry) {
            throw new Error(`No log entry found for revision: ${revision}`);
        }
        await ctx.host.nav.copyToClipboard(entry.change_id);
    } catch (err: unknown) {
        await showJjError(ctx.host.ui, err, 'Error copying change ID', ctx.repo.jj, ctx.log);
    }
}
