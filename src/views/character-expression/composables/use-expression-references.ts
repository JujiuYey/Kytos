import { computed, ref, type Ref } from 'vue';
import type {
  CharacterExpressionRecord,
  CharacterExpressionReferenceSelection,
  CharacterAnchorWorkspaceState,
} from '@/types';
import type { ExpressionReferenceOption } from '../expression-reference';

interface UseExpressionReferencesOptions {
  anchorWorkspace: Readonly<Ref<CharacterAnchorWorkspaceState | null>>;
  records: Readonly<Ref<CharacterExpressionRecord[]>>;
}

function referenceAssetKey(selection: CharacterExpressionReferenceSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

export function useExpressionReferences(options: UseExpressionReferencesOptions) {
  const selectedReferenceAssets = ref<CharacterExpressionReferenceSelection[]>([]);

  const referenceOptions = computed<ExpressionReferenceOption[]>(() => {
    const workspace = options.anchorWorkspace.value;
    if (!workspace) {
      return [];
    }

    const anchorOptions = workspace.records.flatMap(record =>
      record.status === 'completed'
        ? record.images.map(image => {
            const selection = {
              fileName: image.fileName,
              kind: 'visual' as const,
              taskId: record.id,
            };
            return {
              detail: `角色锚点 · ${record.size}`,
              image,
              key: referenceAssetKey(selection),
              label: image.name || record.name || '角色锚点',
              selection,
              source: 'visual' as const,
            };
          })
        : [],
    );
    const expressionOptions = options.records.value.flatMap(record =>
      record.status === 'completed'
        ? record.images.map((image, index) => {
            const selection = {
              fileName: image.fileName,
              kind: 'expression' as const,
              taskId: record.id,
            };
            return {
              detail: record.source === 'uploaded' ? '已有表情 · 上传' : '已有表情 · 生成',
              image,
              key: referenceAssetKey(selection),
              label: record.images.length > 1 ? `${record.name} ${index + 1}` : record.name,
              selection,
              source: 'expression' as const,
            };
          })
        : [],
    );

    return [...anchorOptions, ...expressionOptions];
  });
  const selectedReferenceKeys = computed(() =>
    selectedReferenceAssets.value.map(referenceAssetKey),
  );
  const selectedReferenceOptions = computed(() => {
    const selectedKeySet = new Set(selectedReferenceKeys.value);
    return referenceOptions.value.filter(option => selectedKeySet.has(option.key));
  });
  const hasReferences = computed(() => referenceOptions.value.length > 0);

  function selectReferenceAssets(keys: string[]): void {
    const selectedKeySet = new Set(keys);
    selectedReferenceAssets.value = referenceOptions.value
      .filter(option => selectedKeySet.has(option.key))
      .map(option => ({
        fileName: option.selection.fileName,
        kind: option.selection.kind,
        taskId: option.selection.taskId,
      }));
  }

  function resetReferences(): void {
    selectedReferenceAssets.value = [];
  }

  return {
    hasReferences,
    referenceOptions,
    resetReferences,
    selectedReferenceAssets,
    selectedReferenceKeys,
    selectedReferenceOptions,
    selectReferenceAssets,
  };
}
