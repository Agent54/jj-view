/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { CommandContext } from '../host/command-context';
import { showJjError } from '../host/ui-helpers';

export interface CreateTagPayload {
    revision?: string;
}

export async function createTagCommand(ctx: CommandContext, payload?: CreateTagPayload): Promise<void> {
    const revision = payload?.revision ?? '@';

    try {
        const input = await ctx.host.ui.showInputBox({
            prompt: 'Create a tag',
            placeHolder: 'Tag name (e.g. v1.0.0)',
            validateInput: (value) => (value.trim() ? undefined : 'Enter a tag name'),
        });
        const name = input?.trim();
        if (!name) {
            return;
        }

        await ctx.host.ui.withProgress(`Creating tag ${name}...`, () => ctx.repo.jj.createTag(name, revision));
        await ctx.repo.refresh({ reason: 'after tag create' });
    } catch (err: unknown) {
        await showJjError(ctx.host.ui, err, 'Error creating tag', ctx.repo.jj, ctx.log);
    }
}
