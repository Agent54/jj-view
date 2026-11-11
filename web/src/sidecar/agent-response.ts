/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from 'zod';
import type { AgentMessageResponse } from './sidecar-types';

const errorResponse = z.object({ error: z.string() });
const messageResponse = z.object({
    messageId: z.string().optional(),
    conversationId: z.string().optional(),
    status: z.enum(['delivered', 'queued', 'rejected']),
    response: z.string().optional(),
    error: z.string().optional(),
});
const queuedResponse = z.object({
    response: z.object({ sendMessage: z.object({ recipientId: z.string() }) }),
});

export function parseAgentMessageResponse(value: unknown): AgentMessageResponse {
    const error = errorResponse.safeParse(value);
    if (error.success) {
        throw new Error(error.data.error);
    }
    const message = messageResponse.safeParse(value);
    if (message.success) {
        return message.data;
    }
    // agentapi echoes a send request; it is not the assistant's generated text or a completion receipt.
    const queued = queuedResponse.safeParse(value);
    if (queued.success) {
        return { status: 'queued', conversationId: queued.data.response.sendMessage.recipientId };
    }
    throw new Error(
        'The Antigravity agent returned an unrecognized response. Open its conversation to check the request.',
    );
}
