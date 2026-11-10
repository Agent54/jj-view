/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createTagCommand } from '../../core/commands/tag';
import type { JjRepository } from '../../core/jj-repository';
import { JjService, NO_OP_LOGGER } from '../../core/jj-service';
import { FakeCommandContext } from '../fake-host-environment';
import { TestRepo } from '../test-repo';
import { createMock } from '../test-utils';

describe.each([true, false])('createTagCommand (colocate: %s)', (colocate) => {
    let repo: TestRepo;
    let jj: JjService;
    let ctx: FakeCommandContext;

    beforeEach(() => {
        repo = new TestRepo();
        repo.init({ colocate });
        jj = new JjService(repo.path, NO_OP_LOGGER);
        ctx = new FakeCommandContext(createMock<JjRepository>({ jj, refresh: vi.fn().mockResolvedValue(undefined) }));
    });

    afterEach(async () => {
        await repo.dispose();
    });

    test('creates a trimmed tag on the selected revision and refreshes', async () => {
        repo.writeFile('release.txt', 'release content\n');
        repo.describe('release');
        const target = repo.getCommitId('@');
        repo.new();
        ctx.host.ui.setNextInputBoxResponse('  v1.0.0  ');

        await createTagCommand(ctx, { revision: target });

        expect(ctx.host.ui.errorMessages).toEqual([]);
        expect(repo.getCommitId('v1.0.0')).toBe(target);
        expect((await jj.getLogEntry(target))?.tags).toContain('v1.0.0');
        expect((await jj.getLogEntry('@'))?.tags).not.toContain('v1.0.0');
        expect(ctx.repo.refresh).toHaveBeenCalledOnce();

        if (colocate) {
            const gitRoot = await jj.getGitRoot();
            if (!gitRoot) {
                throw new Error('Expected a Git repository');
            }
            const gitTag = execFileSync(
                TestRepo.getGitBinary(),
                ['--git-dir', gitRoot, 'rev-parse', 'refs/tags/v1.0.0'],
                {
                    encoding: 'utf8',
                },
            ).trim();
            expect(gitTag).toBe(target);
        }
    });

    test('defaults to the working copy when invoked without a revision', async () => {
        repo.writeFile('release.txt', 'release content\n');
        const target = repo.getCommitId('@');
        ctx.host.ui.setNextInputBoxResponse('v2.0.0');

        await createTagCommand(ctx);

        expect(ctx.host.ui.errorMessages).toEqual([]);
        expect(repo.getCommitId('v2.0.0')).toBe(target);
    });

    test.each([undefined, '', '   '])('does nothing when the input is %s', async (input) => {
        ctx.host.ui.setNextInputBoxResponse(input);

        await createTagCommand(ctx, { revision: '@' });

        expect((await jj.getLogEntry('@'))?.tags).toEqual([]);
        expect(ctx.repo.refresh).not.toHaveBeenCalled();
        expect(ctx.host.ui.errorMessages).toEqual([]);
    });

    test('reports duplicate tags without moving the existing tag', async () => {
        repo.writeFile('release.txt', 'original release\n');
        repo.new();
        repo.tag('v1.0.0', '@-');
        const original = repo.getCommitId('v1.0.0');
        ctx.host.ui.setNextInputBoxResponse('v1.0.0');

        await createTagCommand(ctx, { revision: '@' });

        expect(repo.getCommitId('v1.0.0')).toBe(original);
        expect(ctx.host.ui.errorMessages).toHaveLength(1);
        expect(ctx.host.ui.errorMessages[0]).toContain('Error creating tag');
        expect(ctx.repo.refresh).not.toHaveBeenCalled();
    });

    test('reports invalid tag names without creating a tag', async () => {
        ctx.host.ui.setNextInputBoxResponse('invalid..tag');

        await createTagCommand(ctx, { revision: '@' });

        expect((await jj.getLogEntry('@'))?.tags).toEqual([]);
        expect(ctx.host.ui.errorMessages).toHaveLength(1);
        expect(ctx.repo.refresh).not.toHaveBeenCalled();
    });

    test('does not interpret a tag name as a command option', async () => {
        ctx.host.ui.setNextInputBoxResponse('--allow-move');

        await createTagCommand(ctx, { revision: '@' });

        expect(ctx.host.ui.errorMessages.join('\n')).not.toContain('required arguments');
        expect(ctx.repo.refresh).not.toHaveBeenCalled();
        expect(ctx.host.ui.errorMessages).toHaveLength(1);
    });
});
