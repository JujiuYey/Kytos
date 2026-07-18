<template>
  <main class="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <header
      v-if="$slots.header"
      class="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2 sm:px-5"
    >
      <slot name="header" />
    </header>

    <slot />
  </main>
</template>
