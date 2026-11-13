/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CodeForgeProvider } from '../core/code-forge-provider';
import { CodeForgeRegistry } from '../core/code-forge-registry';
import { EventEmitter } from '../core/host/events';
import { JjRepository } from '../core/jj-repository';
import type { CodeForgeChangeInfo } from '../core/jj-types';
import { Uri } from '../core/uri-utils';
import { FakeHostEnvironment } from './fake-host-environment';
import { TestRepo } from './test-repo';
import { createMock, createMockLogOutputChannel } from './test-utils';

describe('JjRepository.refresh error handling', () => {
    let repo: TestRepo;
    let jjRepo: JjRepository;
    let host: FakeHostEnvironment;

    beforeEach(() => {
        host = new FakeHostEnvironment();
        repo = new TestRepo();
        repo.init();
    });

    afterEach(async () => {
        if (jjRepo) {
            await jjRepo.dispose();
        }
    });

    test('refresh() propagates error when jj operations reject on invalid repo binary/path', async () => {
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel(),
            host,
            '/non/existent/jj/binary/path',
        );

        await expect(jjRepo.refresh({ forceSnapshot: true })).rejects.toThrow();
    });

    test('refresh() resolves successfully on valid repo', async () => {
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel(),
            host,
        );

        await expect(jjRepo.refresh({ forceSnapshot: true })).resolves.toBeUndefined();
    });

    test('refresh() on disposed repository resolves immediately', async () => {
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel(),
            host,
        );

        await jjRepo.dispose();
        await expect(jjRepo.refresh({ forceSnapshot: true })).resolves.toBeUndefined();
    });

    test('dispose() waits for active in-flight refresh to complete cleanly', async () => {
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel(),
            host,
        );

        const refreshPromise = jjRepo.refresh({ forceSnapshot: true });
        expect(jjRepo.activeRefresh).toBeDefined();

        await jjRepo.dispose();
        await expect(refreshPromise).resolves.toBeUndefined();
        expect(jjRepo.activeRefresh).toBeUndefined();
    });

    test('dispose() cancels pending background debounce timer immediately', async () => {
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel(),
            host,
        );

        // Trigger a background file save event to start a debounce timer
        host.documents.fireDidSaveDocument(Uri.file(path.join(repo.path, 'file.txt')));
        expect(jjRepo.activeRefresh).toBeDefined();

        await jjRepo.dispose();
        expect(jjRepo.activeRefresh).toBeUndefined();
    });

    test('dispose() cleans up onDidStatusChange event emitter', async () => {
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel(),
            host,
        );

        const statusListener = vi.fn();
        jjRepo.onDidStatusChange(statusListener);

        await jjRepo.dispose();

        // In JjRepository, listeners are cleaned up and events are no longer fired after dispose
        expect(statusListener).not.toHaveBeenCalled();
    });

    test('refresh() preserves code forge cache across refreshes', async () => {
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel(),
            host,
        );

        const clearForgeSpy = vi.spyOn(jjRepo.codeForge, 'clearCache');
        await jjRepo.refresh({ reason: 'manual' });
        await jjRepo.refresh({ reason: 'focus refresh', forceSnapshot: true });

        expect(clearForgeSpy).not.toHaveBeenCalled();
    });

    test('cached change info is preserved when repository refreshes', async () => {
        const registry = new CodeForgeRegistry();
        const fakeChange = createMock<CodeForgeChangeInfo>({
            id: 'change-1',
            number: 101,
            displayLabel: 'Change 101',
            status: 'NEW',
        });
        const cache = new Map<string, CodeForgeChangeInfo>([['change-1', fakeChange]]);
        const mockProvider = createMock<CodeForgeProvider>({
            id: 'mock-provider',
            detect: async () => true,
            onDidUpdate: new EventEmitter<void>().event,
            getCachedChangeInfo: vi.fn((id: string) => cache.get(id)),
            fetchStatuses: vi.fn().mockResolvedValue(false),
            clearCache: vi.fn(() => cache.clear()),
            activate: () => {},
            deactivate: () => {},
        });
        registry.register({ id: 'mock-provider', create: () => mockProvider });

        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            registry,
            createMockLogOutputChannel(),
            host,
        );

        await jjRepo.codeForge.detectActiveProvider(true);
        expect(jjRepo.codeForge.activeProvider?.id).toBe('mock-provider');

        // Verify initial cache lookup
        const initial = jjRepo.codeForge.activeProvider?.getCachedChangeInfo('change-1');
        expect(initial).toEqual(fakeChange);

        // Perform manual and focus refreshes
        await jjRepo.refresh({ reason: 'manual' });
        await jjRepo.refresh({ reason: 'focus refresh', forceSnapshot: true });

        // Ensure clearCache was not invoked and cached change info remains intact
        expect(mockProvider.clearCache).not.toHaveBeenCalled();
        const afterRefresh = jjRepo.codeForge.activeProvider?.getCachedChangeInfo('change-1');
        expect(afterRefresh).toEqual(fakeChange);
    });
});

describe('JjRepository.refresh cache invalidation', () => {
    let repo: TestRepo;
    let jjRepo: JjRepository;
    let host: FakeHostEnvironment;

    beforeEach(() => {
        host = new FakeHostEnvironment();
        repo = new TestRepo();
        repo.init();
        repo.writeFile('a.txt', 'one\n');
        repo.snapshot();
        repo.new();
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel(),
            host,
        );
    });

    afterEach(async () => {
        await jjRepo.dispose();
        await repo.dispose();
    });

    test('a refresh with no repository changes preserves the warmed diff cache', async () => {
        await jjRepo.refresh({ reason: 'initial', forceSnapshot: true });

        const warmed = await jjRepo.jj.getDiffForRevision('@');
        expect(fs.existsSync(warmed.tempDir)).toBe(true);

        await jjRepo.refresh({ reason: 'focus refresh', forceSnapshot: true });
        await jjRepo.refresh({ reason: 'jj operation' });

        const afterRefresh = await jjRepo.jj.getDiffForRevision('@');
        expect(afterRefresh.tempDir).toBe(warmed.tempDir);
        expect(fs.existsSync(warmed.tempDir)).toBe(true);
    });

    test('a refresh that snapshots a working-copy edit invalidates the diff cache', async () => {
        await jjRepo.refresh({ reason: 'initial', forceSnapshot: true });
        const warmed = await jjRepo.jj.getDiffForRevision('@');

        repo.writeFile('a.txt', 'two\n');
        await jjRepo.refresh({ reason: 'file watcher event', forceSnapshot: true });

        const afterRefresh = await jjRepo.jj.getDiffForRevision('@');
        expect(afterRefresh.tempDir).not.toBe(warmed.tempDir);
        expect(fs.existsSync(warmed.tempDir)).toBe(false);
        expect(await jjRepo.jj.getDiffContent('@', path.join(repo.path, 'a.txt'))).toEqual({
            left: 'one\n',
            right: 'two\n',
        });
    });

    test('a refresh after an external jj operation invalidates the diff cache', async () => {
        await jjRepo.refresh({ reason: 'initial', forceSnapshot: true });
        const warmed = await jjRepo.jj.getDiffForRevision('@');

        repo.describe('external edit');
        await jjRepo.refresh({ reason: 'jj operation' });

        const afterRefresh = await jjRepo.jj.getDiffForRevision('@');
        expect(afterRefresh.tempDir).not.toBe(warmed.tempDir);
        expect(fs.existsSync(warmed.tempDir)).toBe(false);
    });
});

describe('JjRepository workspace snapshots', () => {
    let repo: TestRepo;
    let jjRepo: JjRepository;
    let workspaces: TestRepo[];
    const warn = vi.fn();

    beforeEach(() => {
        workspaces = [];
        warn.mockClear();
        repo = new TestRepo();
        repo.init();
        repo.config('snapshot.auto-update-stale', 'true');
        repo.writeFile('.gitignore', '.workspaces/\n');
        repo.writeFile('base.txt', 'base\n');
        repo.writeFile('deleted.txt', 'remove me\n');
        repo.describe('Shared base');
        repo.new();
        const host = new FakeHostEnvironment();
        host.ui.setActive(false);
        jjRepo = new JjRepository(
            Uri.file(repo.path),
            path.join(repo.path, '.jj', 'repo'),
            new CodeForgeRegistry(),
            createMockLogOutputChannel({ warn }),
            host,
        );
    });

    afterEach(async () => {
        await jjRepo.dispose();
        for (const workspace of workspaces) {
            await workspace.dispose();
        }
        await repo.dispose();
    });

    function addWorkspace(name: string): TestRepo {
        const workspace = repo.workspaceAdd(name, '@-', path.join(repo.path, '.workspaces', name));
        workspaces.push(workspace);
        return workspace;
    }

    test('poll snapshots newly discovered workspaces and invalidates their warmed diffs', async () => {
        await jjRepo.refresh({ forceSnapshot: true, reason: 'initial' });
        const agent = addWorkspace('agent');
        const agentChange = agent.getChangeId('@');
        const currentChange = repo.getChangeId('@');
        await jjRepo.refresh({ forceSnapshot: true, reason: 'poll' });
        const warmed = await jjRepo.jj.getDiffForRevision(agentChange);

        // TestRepo.writeFile snapshots automatically. Write directly to model an
        // editor/agent that changes files without running any jj command.
        fs.writeFileSync(path.join(agent.path, 'base.txt'), 'agent edit\n');
        fs.writeFileSync(path.join(agent.path, 'added.txt'), 'agent addition\n');
        fs.rmSync(path.join(agent.path, 'deleted.txt'));
        expect(repo.getFileContent(agentChange, 'base.txt')).toBe('base\n');

        await jjRepo.refresh({ forceSnapshot: true, reason: 'poll' });

        expect(repo.getFileContent(agentChange, 'base.txt')).toBe('agent edit\n');
        expect(repo.getFileContent(agentChange, 'added.txt')).toBe('agent addition\n');
        expect(repo.getFiles(agentChange)).not.toContain('deleted.txt');
        expect(repo.getChangeId('@')).toBe(currentChange);
        expect(repo.getFileContent('@', 'base.txt')).toBe('base\n');
        const refreshed = await jjRepo.jj.getDiffForRevision(agentChange);
        expect(refreshed.tempDir).not.toBe(warmed.tempDir);
        expect(fs.existsSync(warmed.tempDir)).toBe(false);

        await jjRepo.refresh({ forceSnapshot: true, reason: 'poll' });
        expect((await jjRepo.jj.getDiffForRevision(agentChange)).tempDir).toBe(refreshed.tempDir);
    });

    test('poll updates a stale secondary workspace and records its pending edits in history', async () => {
        const agent = addWorkspace('agent');
        fs.writeFileSync(path.join(agent.path, 'local.txt'), 'unrecorded agent work\n');
        repo.writeFile('base.txt', 'rewritten base\n');
        repo.squash();
        expect(agent.readFile('base.txt')).toBe('base\n');
        expect(agent.readFile('local.txt')).toBe('unrecorded agent work\n');

        await jjRepo.refresh({ forceSnapshot: true, reason: 'poll' });

        expect(agent.readFile('base.txt')).toBe('rewritten base\n');
        // JJ can retain simultaneous edits as a divergent revision instead of
        // choosing it as agent@. Verify the edit is recorded and visible in the log.
        const entries = await jjRepo.jj.getLog({ revision: 'all()' });
        const recorded = entries.find((entry) => entry.changes?.some((change) => change.path === 'local.txt'));
        expect(recorded).toBeDefined();
        if (!recorded) {
            throw new Error('Expected the pending agent edit in the shared history');
        }
        expect(repo.getFileContent(recorded.commit_id, 'local.txt')).toBe('unrecorded agent work\n');
    });

    test('poll refreshes the displayed checkout after an ancestor workspace changes', async () => {
        const agent = addWorkspace('agent');
        repo.rebase({ revision: '@', destination: 'agent@' });
        const currentChange = repo.getChangeId('@');
        fs.writeFileSync(path.join(agent.path, 'base.txt'), 'updated ancestor\n');

        await jjRepo.refresh({ forceSnapshot: true, reason: 'poll' });

        expect(repo.getChangeId('@')).toBe(currentChange);
        expect(repo.readFile('base.txt')).toBe('updated ancestor\n');
        expect(repo.getFileContent('agent@', 'base.txt')).toBe('updated ancestor\n');
    });

    test('poll continues past missing workspaces and directories without workspace metadata', async () => {
        const missing = addWorkspace('a-missing');
        const invalid = addWorkspace('b-invalid');
        const healthy = addWorkspace('c-healthy');
        fs.rmSync(missing.path, { recursive: true });
        fs.rmSync(path.join(invalid.path, '.jj'), { recursive: true });
        fs.writeFileSync(path.join(healthy.path, 'agent.txt'), 'healthy workspace\n');
        fs.writeFileSync(path.join(repo.path, 'base.txt'), 'main edit\n');

        await jjRepo.refresh({ forceSnapshot: true, reason: 'poll' });

        expect(repo.getFileContent('c-healthy@', 'agent.txt')).toBe('healthy workspace\n');
        expect(repo.getFileContent('@', 'base.txt')).toBe('main edit\n');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('a-missing'));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('b-invalid'));
    });
});
