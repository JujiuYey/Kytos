<script setup lang="ts">
import { computed } from 'vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import type {
  CharacterAnchorRecord,
  CharacterAnchorSelection,
  CharacterVisualImage,
} from '@/types';
import AnchorEmptyState from './anchor-empty-state.vue';
import AnchorImageCard from './anchor-image-card.vue';
import AnchorTaskCard from './anchor-task-card.vue';

interface GalleryEntryBase {
  imageIndex: number;
  key: string;
  record: CharacterAnchorRecord;
}

interface GalleryImageEntry extends GalleryEntryBase {
  image: CharacterVisualImage;
  type: 'image';
}

interface GalleryTaskEntry extends GalleryEntryBase {
  image: null;
  type: 'task';
}

type GalleryEntry = GalleryImageEntry | GalleryTaskEntry;

const props = defineProps<{
  deletingFileName: string;
  officialAssets: CharacterAnchorSelection[];
  pollingState: GenerationTaskPollingState;
  records: CharacterAnchorRecord[];
  renamingFileName: string;
  selectingFileName: string;
}>();

const emit = defineEmits<{
  (event: 'delete', record: CharacterAnchorRecord, image: CharacterVisualImage): void;
  (event: 'edit', record: CharacterAnchorRecord, image: CharacterVisualImage): void;
  (
    event: 'official',
    record: CharacterAnchorRecord,
    image: CharacterVisualImage,
    official: boolean,
  ): void;
  (event: 'rename', record: CharacterAnchorRecord, image: CharacterVisualImage): void;
}>();

const activeStatuses = ['submitted', 'pending', 'processing'] as const;

const galleryEntries = computed<GalleryEntry[]>(() => createEntries(props.records));

function createEntries(records: CharacterAnchorRecord[]): GalleryEntry[] {
  return records.flatMap((record): GalleryEntry[] => {
    if (
      activeStatuses.includes(record.status as (typeof activeStatuses)[number]) ||
      record.status === 'failed' ||
      record.status === 'cancelled'
    ) {
      return [
        {
          image: null,
          imageIndex: -1,
          key: `${record.id}:task`,
          record,
          type: 'task' as const,
        },
      ];
    }

    return record.images.map(
      (image, imageIndex): GalleryImageEntry => ({
        image,
        imageIndex,
        key: `${record.id}:${image.fileName}`,
        record,
        type: 'image',
      }),
    );
  });
}

function isSelected(entry: GalleryEntry): boolean {
  if (!entry.image) {
    return false;
  }
  return props.officialAssets.some(
    asset => asset.taskId === entry.record.id && asset.fileName === entry.image?.fileName,
  );
}
</script>

<template>
  <section class="flex min-h-0 flex-col bg-muted/15" aria-label="角色图片资产库">
    <ScrollArea class="min-h-0 flex-1">
      <div
        v-if="galleryEntries.length"
        class="mx-auto w-full max-w-7xl columns-1 gap-5 px-4 py-5 sm:columns-2 sm:px-5 xl:columns-3 2xl:columns-4"
      >
        <article
          v-for="entry in galleryEntries"
          :key="entry.key"
          :class="[
            'mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-md border bg-background align-top',
            isSelected(entry) && 'border-primary/40 ring-1 ring-primary/10',
          ]"
        >
          <AnchorTaskCard
            v-if="entry.type === 'task'"
            :polling-state="pollingState"
            :record="entry.record"
          />
          <AnchorImageCard
            v-else
            :deleting-file-name="deletingFileName"
            :image="entry.image"
            :image-index="entry.imageIndex"
            :is-selected="isSelected(entry)"
            :record="entry.record"
            :renaming-file-name="renamingFileName"
            :selecting-file-name="selectingFileName"
            @delete="emit('delete', entry.record, entry.image)"
            @edit="emit('edit', entry.record, entry.image)"
            @official="official => emit('official', entry.record, entry.image, official)"
            @rename="emit('rename', entry.record, entry.image)"
          />
        </article>
      </div>

      <AnchorEmptyState
        v-else
        description="可以创建或上传已有图片，建立角色锚点资产。"
        title="还没有角色图片"
      />
    </ScrollArea>
  </section>
</template>
