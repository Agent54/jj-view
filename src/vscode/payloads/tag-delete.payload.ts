/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { extractTagName } from '../../core/commands/command-utils';
import type { DeleteTagPayload } from '../../core/commands/tag-delete';

export function createDeleteTagPayload(args: unknown[]): DeleteTagPayload {
    return { tagName: extractTagName(args) };
}
