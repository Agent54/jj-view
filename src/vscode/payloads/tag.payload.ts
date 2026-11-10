/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { extractRevisions } from '../../core/commands/command-utils';
import type { CreateTagPayload } from '../../core/commands/tag';

export function createTagPayload(args: unknown[]): CreateTagPayload {
    return { revision: extractRevisions(args)[0] ?? '@' };
}
