/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { JjService } from '../../src/core/jj-service';
import { TestRepo } from '../../src/test/test-repo';
import { parseAgentMessageResponse } from '../src/sidecar/agent-response';
import { generateCommitDescription } from '../src/sidecar/commit-description';
import { SidecarService } from '../src/sidecar/sidecar-service';
import type { AgentMessageResponse, SidecarAgentBridge, SidecarBridge } from '../src/sidecar/sidecar-types';
import { createMock } from './test-mock';

describe('commit descriptions through the existing agent', () => {
    let repo: TestRepo;
    let jj: JjService;
    const sendMessage = vi.fn<(message: string) => Promise<AgentMessageResponse>>();
    let sidecar: SidecarService;

    beforeEach(() => {
        repo = new TestRepo();
        repo.init();
        jj = new JjService(repo.path);
        sendMessage.mockReset();
        sendMessage.mockResolvedValue({ status: 'delivered', response: 'feat: add older feature' });
        sidecar = new SidecarService(
            createMock<SidecarBridge>({
                agent: createMock<SidecarAgentBridge>({ sendMessage }),
            }),
        );
    });

    afterEach(async () => {
        sidecar.dispose();
        await repo.dispose();
    });

    test('uses the chosen revision diff without changing the working copy', async () => {
        repo.writeFile('older.txt', 'older feature\n');
        repo.describe('Original description');
        const revision = repo.getCommitId('@');
        const changeId = repo.getChangeId('@');
        repo.new();
        repo.writeFile('current.txt', 'unrelated current work\n');
        const currentChange = repo.getChangeId('@');
        const result = await generateCommitDescription(jj, sidecar, revision);
        expect(result).toEqual({ changeId, description: 'feat: add older feature' });
        const prompt = sendMessage.mock.calls[0]?.[0];
        expect(prompt).toContain(revision);
        expect(prompt).toContain(changeId);
        expect(prompt).toContain(repo.path);
        expect(prompt).toContain('older feature');
        expect(prompt).not.toContain('unrelated current work');
        expect(prompt).toContain('jj describe -r <changeId>');
        expect(repo.getChangeId('@')).toBe(currentChange);
        expect((await jj.getLogEntry(changeId))?.description.trim()).toBe('Original description');
    });

    test('refuses a stale generated description', async () => {
        repo.describe('Original');
        sendMessage.mockImplementation(async () => {
            repo.describe('User edited meanwhile');
            return { status: 'delivered', response: 'Stale AI text' };
        });
        await expect(generateCommitDescription(jj, sidecar, '@')).rejects.toThrow('commit changed');
        expect((await jj.getLogEntry('@'))?.description.trim()).toBe('User edited meanwhile');
    });

    test('rejects immutable revisions before contacting the agent', async () => {
        await expect(generateCommitDescription(jj, sidecar, 'root()')).rejects.toThrow('Immutable');
        expect(sendMessage).not.toHaveBeenCalled();
    });

    test('supports empty commits and distinguishes queued work from generated text', async () => {
        sendMessage.mockResolvedValue(
            parseAgentMessageResponse({
                response: { sendMessage: { recipientId: 'existing-conversation', content: 'request echo' } },
            }),
        );
        const result = await generateCommitDescription(jj, sidecar, '@');
        expect(result.description).toBeUndefined();
        expect(sendMessage.mock.calls[0]?.[0]).toContain('"diff":""');
        expect((await jj.getLogEntry('@'))?.description.trim()).toBe('');
    });

    test('reports rejected and empty agent responses instead of silently doing nothing', async () => {
        sendMessage.mockResolvedValue({ status: 'rejected', error: 'Agent offline' });
        await expect(generateCommitDescription(jj, sidecar, '@')).rejects.toThrow('Agent offline');
        sendMessage.mockResolvedValue({ status: 'delivered', response: '   ' });
        await expect(generateCommitDescription(jj, sidecar, '@')).rejects.toThrow('no description');
    });

    test('parses direct text responses and reports backend setup errors', () => {
        expect(parseAgentMessageResponse({ status: 'delivered', response: 'feat: update' }).response).toBe(
            'feat: update',
        );
        expect(() => parseAgentMessageResponse({ error: 'agentapi missing' })).toThrow('agentapi missing');
        expect(() => parseAgentMessageResponse({ response: {} })).toThrow('unrecognized response');
    });
});
