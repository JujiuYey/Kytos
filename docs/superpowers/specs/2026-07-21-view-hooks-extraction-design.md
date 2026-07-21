# Kytos View Hooks Extraction — Design

**Date:** 2026-07-21
**Status:** Draft (pending user review)
**Scope:** `src/views/**/*.vue` of `/Users/jujiuyey/Projects/Kytos`
**Constraint (user-imposed):** Existing behavior must be preserved 1:1. Extraction is non-behavioral.

## 1. Problem

Several view files in `src/views/` are large monolithic Vue SFCs whose `<script setup>` blocks
mix orchestration, UI state, RPC calls, polling timers, and lifecycle cleanup together. The
duplication across views is concentrated in two areas:

| Concern | Where it appears | Duplication |
|---|---|---|
| Credential status loading (deepseek + apimart) | `illustration/index.vue`, `story/index.vue`, `character-expression/index.vue`, `character-portrait/index.vue` | 4× essentially identical `ref + computed + initialize()` |
| Generation task polling (multi-key map, timer cleanup on unmount) | `illustration/index.vue`, `story/index.vue` | 2× near-verbatim `pollTimers` / `pollingStates` / `schedulePoll` / `pollTask` / `disposed` / `onBeforeUnmount` block |

The remaining logic in those views (UI flags, dialog state, view-specific orchestration around
`useChat`) is **not** duplicated and should not be extracted for extraction's sake.

Goal: extract only the two genuinely duplicated concerns into Vue composables, so the remaining
view logic is more readable and the lifecycle-cleanup correctness is encoded once instead of
repeated.

## 2. Non-Goals

- NOT extracting single-task polling (`character-portrait`, `character-expression`) in this spec.
  Defer to a follow-up spec once the multi-task version has stabilized.
- NOT refactoring UI flags, dialog state, `useChat` wrappers, or other view-local logic into
  composables or sub-components.
- NOT introducing a test framework. Project has none; verification is lint + typecheck + manual
  behavior parity.

## 3. Design — `useCredentialStatus()`

### 3.1 Location

`src/composables/use-credential-status.ts`

### 3.2 Signature

```ts
import type { ComputedRef, Ref } from 'vue';
import type { CredentialStatus } from '@/types';

export interface CredentialStatusBundle {
  deepseekStatus: Ref<CredentialStatus | null>;
  apimartStatus: Ref<CredentialStatus | null>;
  deepseekConfigured: ComputedRef<boolean>;
  apimartConfigured: ComputedRef<boolean>;
  refresh: () => Promise<void>;
}

export function useCredentialStatus(): CredentialStatusBundle;
```

### 3.3 Behavior

- `useCredentialStatus()` must be called inside a `<script setup>` block (Vue lifecycle binding).
- `refresh()` issues two RPCs concurrently via `Promise.all`:
  `window.desktop.settings.getCredentialStatus('deepseek')` and
  `window.desktop.settings.getCredentialStatus('apimart')`.
- On success: writes both `ref`s with the resolved `CredentialStatus` values.
- On failure: silently preserves the previous values. **Rationale:** current views do not
  surface a per-channel credential error; failures bubble as part of the outer `initialize()`
  try/catch which already absorbs them. Preserving the previous value matches current behavior
  (the previous successful read remains authoritative until the next refresh succeeds).

### 3.4 View call site (illustrative)

Before — `illustration/index.vue` lines 51–52, 77–78, 313–314:

```ts
const deepseekStatus = ref<CredentialStatus | null>(null);
const apimartStatus = ref<CredentialStatus | null>(null);
// ...
const deepseekConfigured = computed(() => Boolean(deepseekStatus.value?.configured));
const apimartConfigured = computed(() => Boolean(apimartStatus.value?.configured));
// ...inside initialize():
const [/*...*/, deepseek, apimart] = await Promise.all([/*...*/,
  window.desktop.settings.getCredentialStatus('deepseek'),
  window.desktop.settings.getCredentialStatus('apimart'),
]);
deepseekStatus.value = deepseek;
apimartStatus.value = apimart;
```

After:

```ts
const {
  deepseekStatus, apimartStatus,
  deepseekConfigured, apimartConfigured,
  refresh: refreshCredentialStatus,
} = useCredentialStatus();
// ...inside initialize() — replace the credential RPCs and assignments:
await Promise.all([
  /* ... other RPCs ... */,
  refreshCredentialStatus(),
]);
```

Views using only one channel (e.g. `character-portrait`) simply ignore the other exposed fields.

## 4. Design — `useGenerationPolling<T>()`

### 4.1 Location

`src/composables/use-generation-polling.ts`

### 4.2 Signature

```ts
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';
import type { Ref } from 'vue';

export interface GenerationPollingOptions<TVersion> {
  fetchTask: (taskId: string) => Promise<TVersion>;
  isStillRunning: (version: TVersion) => boolean;
  intervalMs?: number; // default 2500
  /**
   * Called on every successful fetch, regardless of whether the task is still running or
   * has reached a terminal status. Use this to clear transient error UI state (e.g. reset
   * `generationError.value = ''`). Mirrors current `illustration/index.vue:462` behavior.
   */
  onPollSuccess?: (taskId: string, version: TVersion) => void;
  onCompleted?: (taskId: string, version: TVersion) => void;
  onFailed?: (taskId: string, version: TVersion, message: string) => void;
  onError?: (taskId: string, error: unknown) => void;
}

export interface GenerationPollingBundle {
  pollingStates: Ref<GenerationPollingStateMap>;
  schedulePoll: (taskId: string) => void;
  cancel: (taskId: string) => void;
  cancelAll: () => void;
}

export function useGenerationPolling<TVersion>(
  options: GenerationPollingOptions<TVersion>,
): GenerationPollingBundle;
```

### 4.3 Behavior

- Must be called inside a `<script setup>` block.
- Owns: `pollingStates` (reactive map of `taskId -> { attempt, phase }`), the `pollTimers`
  `Map<taskId, ReturnType<typeof setTimeout>>`, and a `disposed` flag.
- `schedulePoll(taskId)`:
  1. Clears any existing timer for `taskId`.
  2. Sets `pollingStates[taskId] = { attempt: previous?.attempt ?? 0, phase: 'waiting' }`.
  3. Schedules `pollTask(taskId)` after `intervalMs` (default 2500 ms).
- `pollTask(taskId)` (internal):
  1. If `disposed`, return without work — matches current `illustration/index.vue:451-453`
     and `story/index.vue:466-468` early-return.
  2. Sets `pollingStates[taskId] = { attempt: prev + 1, phase: 'requesting' }`.
  3. Calls `options.fetchTask(taskId)`.
     - On success: invokes `options.onPollSuccess(taskId, version)` **regardless** of whether
       the task is still running. If `isStillRunning(version)` is true, schedules the next
       poll and returns. Otherwise invokes `options.onCompleted(taskId, version)` on terminal
       success or `options.onFailed(taskId, version, ...)` on terminal non-success. Removes
       the entry from `pollingStates` and the timer from `pollTimers` after a terminal outcome.
     - On failure (thrown error): invokes `options.onError`, marks the entry as `phase: 'paused'`,
       and removes the timer.
- `cancel(taskId)`: clears the timer for `taskId`, removes its entry from `pollingStates`.
- `cancelAll()`: clears every timer in `pollTimers`, resets `pollingStates` to `{}`, sets
  `disposed = true`.
- An `onScopeDispose(() => cancelAll())` is registered internally, replacing the explicit
  `onBeforeUnmount` block in current views.

### 4.4 Side-effect delivery — callbacks (decision recorded)

`onCompleted` / `onFailed` / `onError` are passed as options at setup time, **not** through
event-bus or reactive event list. Rationale: view-side effects (toast, `mobilePane.value = ...`,
setting `generationError.value = ...`) are caller-private. Bind them once at the top of
`<script setup>` so `schedulePoll(taskId)` stays a single call from existing handlers in
`generate()` / `submitShotGeneration()`.

### 4.5 View call site (illustrative — `illustration/index.vue`)

Before — lines 69–70, 432–485, 621–628:

```ts
const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pollingStates = ref<GenerationPollingStateMap>({});
// ... function schedulePoll(taskId) { /* ~17 lines */ }
// ... async function pollTask(taskId) { /* ~36 lines */ }
// ... onBeforeUnmount(() => {
//   for (const timer of pollTimers.values()) clearTimeout(timer);
//   pollTimers.clear();
//   pollingStates.value = {};
// });
```

After:

```ts
const { pollingStates, schedulePoll } = useGenerationPolling<IllustrationVersion>({
  fetchTask: id => window.desktop.illustration.getIllustrationTask(id),
  isStillRunning: v =>
    ['submitted', 'pending', 'processing'].includes(v.status),
  onPollSuccess: () => {
    generationError.value = '';
  },
  onCompleted: (_id, version) => {
    toast.success(`V${version.versionNumber} 已生成并保存到工作区`);
    mobilePane.value = 'workspace';
  },
  onFailed: (_id, version, message) => {
    generationError.value = version.errorMessage || message || '插画生成任务未完成';
  },
  onError: (_id, err) => {
    generationError.value = err instanceof Error ? err.message : String(err);
  },
});
```

The internal cleanup (`pollTimers`, `pollingStates = {}`, `disposed`, `onBeforeUnmount`) is
removed from the view. `onPollSuccess` carries the success-side `generationError.value = ''`
reset that currently lives in `illustration/index.vue:462`.

### 4.6 Order-of-operations preservation

Current `pollTask`:

```ts
// existing illustration behavior (lines 450-484)
1. early-return if disposed
2. set phase: requesting, attempt+1
3. fetch
4. on success: clear error (generationError.value = '')
5. on success: if still running, reschedulePoll; else delete state, dispatch onCompleted/onFailed
6. on error: set generationError, set phase: paused, clear timer entry
```

The composable preserves this exact sequence:

1. early-return on dispose — internal `disposed` flag, view never sees it.
2. set `phase: requesting`, attempt+1 — internal.
3. fetch via `options.fetchTask(taskId)`.
4. on success: invoke `options.onPollSuccess(taskId, version)` **first** (this is where
   `generationError.value = ''` lives).
5. if `options.isStillRunning(version)`: schedule next poll, return.
6. else terminal success → `options.onCompleted(taskId, version)`; or non-success terminal →
   `options.onFailed(taskId, version, message)` with `message = version.errorMessage ?? ''`.
   In both terminal cases, delete timer entry and `pollingStates[taskId]`.
7. on thrown error: `options.onError(taskId, err)`, set `pollingStates[taskId].phase = 'paused'`,
   delete timer entry.

### 4.7 `cancel` is exposed but unused in `illustration` / `story` today

`cancel(taskId)` is included for completeness and forward-compatibility (e.g. aborting a single
poll when the user deletes its parent topic). It is **not** wired into the migration PR if no
existing call site needs it — exposed for free, but if YAGNI dictates, can be dropped before
merge.

## 5. Migration Plan

### Stage 1 — validate the design on one view

1. Create `src/composables/use-credential-status.ts`.
2. Create `src/composables/use-generation-polling.ts`.
3. Refactor `src/views/illustration/index.vue` to consume both.
4. Run `pnpm lint && pnpm typecheck`. Both must pass.
5. Manual verification checklist (Section 6).
6. Commit: `refactor(view): extract useCredentialStatus and useGenerationPolling from illustration`.

### Stage 2 — propagate to the other views

For each remaining view, refactor and verify in isolation:

| View | Credential refactor | Polling refactor |
|---|---|---|
| `story/index.vue` | Yes | Yes |
| `character-expression/index.vue` | Yes (`useCredentialStatus` only) | No (single-task, deferred) |
| `character-portrait/index.vue` | Yes (`useCredentialStatus` only) | No (single-task, deferred) |

Each refactor:

- Stage 1's `useCredentialStatus` is now shared. Replace local refs/computed/initialize
  assignments as in Section 3.4.
- For `story`, replace `pollTimers` / `pollingStates` / `schedulePoll` / `pollTask` /
  `onBeforeUnmount` blocks. Bind `onCompleted`/`onFailed`/`onError` with exact existing
  semantics, including the `V${version.versionNumber} 已生成并设为正式画面` toast and
  `workspaceTab.value = 'storyboard'` + `mobilePane.value = 'workspace'` lines.
- For `character-expression` / `character-portrait`, only the credential block changes.
- Run `pnpm lint && pnpm typecheck` after each view.
- Run the manual verification checklist scoped to that view's flows.
- Commit per view: `refactor(view): use shared useCredentialStatus in story` etc.

### Stage 3 — deferred

A separate spec should cover single-task polling (`character-portrait`, `character-expression`).
The decision between `useSingleGenerationPolling` and a parameterized `useGenerationPolling` is
left to that spec; do not preview here.

## 6. Verification Checklist

For each migration commit (or at the end of Stage 1, then end of Stage 2):

- `pnpm lint` — clean.
- `pnpm typecheck` — clean.
- Manual smoke (run inside `pnpm dev`, the Electron app):
  - [ ] Open illustration view → credentials resolve to configured, no error banner.
  - [ ] Trigger a fresh illustration generation → polling begins, attempt counter advances,
         toast appears with `V{number}` on completion, `mobilePane` switches to workspace.
  - [ ] Trigger a second generation while the first is still polling → both task IDs are
         tracked independently in `pollingStates`, both eventually complete.
  - [ ] While a poll is in flight, navigate to `/stories` and back to illustration — no console
         errors about state updates after unmount; polling state for the still-running task is
         preserved only if you stayed in the same view; canceled if you left.
  - [ ] Leave illustration mid-poll → return to it — `onBeforeUnmount` cleanup fires, no leaked
         `setTimeout` (verify via DevTools memory or `performance`).
  - [ ] Open Settings, change apimart key, return to illustration → re-initialize (or whichever
         trigger exists) reflects the new state without flicker back to "unconfigured".
  - [ ] Repeat the above 6 checks for `story`, `character-expression`, `character-portrait`
         where applicable.

## 7. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Behavior drift between old and new code | Section 4.6 + manual checklist. Treat any deviation as a defect, not a "while we're here" improvement. |
| Lifecycle binding surprises if called outside `<script setup>` | Documented in Section 3.3 / 4.3; lint/typecheck both surface this. The only consumer today is inside view SFCs. |
| `effectScope` / `onScopeDispose` disposal timing differences vs explicit `onBeforeUnmount` | Vue 3.5 guarantees `onScopeDispose` fires before `onBeforeUnmount`; the practical effect is identical (timers cleared before state reset). Stage 1's verification covers this. |
| `generationError.value = ''` line gets lost in refactor | Enshrined in Section 4.6 and represented by the `onPollSuccess` callback in the example. Verify with checklist. |
| `cancel(taskId)` exposed but unused — feature creep | Mentioned in Section 4.7. Drop before merge if YAGNI applies. |

## 8. Open Questions Deferred to Follow-up Spec

- Single-task polling: `useSingleGenerationPolling` vs parameterized `useGenerationPolling`
  vs Map-style usage with a single key.
- Whether to migrate the per-view `onCompleted` / `onFailed` to a shared wrapper that handles
  the common parts (toast, mobilePane switch) and only delegates the view-specific extras.
