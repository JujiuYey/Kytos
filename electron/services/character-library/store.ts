// 角色列表、当前角色与角色草稿的 SQLite 持久化
import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type { CharacterSummary } from '../../../shared/character-library';
import { createEmptyCharacterDraft, type CharacterDraft } from '../../../shared/character';
import {
  getWorkspaceDatabase,
  runDatabaseMigrations,
  runInTransaction,
} from '../../storage/database';
import { CHARACTER_LIBRARY_MIGRATIONS } from './schema';
import type { StoredCharacterLibrary } from './types';

type DatabaseRow = Record<string, SQLOutputValue>;

const initializedDatabases = new WeakSet<DatabaseSync>();
let mutationQueue: Promise<void> = Promise.resolve();

export function createCharacterId(): string {
  return `character_${randomUUID()}`;
}

export async function loadStore(): Promise<StoredCharacterLibrary> {
  const database = await getCharacterDatabase();
  let characters = readCharacters(database);
  if (!characters.length) {
    const character = buildNewCharacter('主角色');
    runInTransaction(database, () => {
      saveCharacter(database, character);
      insertDraft(database, character.id, character.name);
      saveActiveCharacter(database, character.id);
    });
    characters = [character];
  }
  const activeRow = database
    .prepare('SELECT active_character_id FROM character_library_state WHERE id = 1')
    .get() as DatabaseRow | undefined;
  const activeCharacterId = readText(activeRow?.active_character_id);
  return {
    activeCharacterId: characters.some(character => character.id === activeCharacterId)
      ? activeCharacterId
      : characters[0].id,
    characters,
    version: 2,
  };
}

export async function saveStore(store: StoredCharacterLibrary): Promise<void> {
  const database = await getCharacterDatabase();
  runInTransaction(database, () => {
    const characterIds = new Set(store.characters.map(character => character.id));
    for (const character of store.characters) {
      saveCharacter(database, character);
      insertDraft(database, character.id, character.name);
    }
    saveActiveCharacter(database, store.activeCharacterId);
    const existingIds = database.prepare('SELECT id FROM characters').all() as DatabaseRow[];
    for (const row of existingIds) {
      const id = readText(row.id);
      if (!characterIds.has(id)) {
        database.prepare('DELETE FROM characters WHERE id = ?').run(id);
      }
    }
  });
}

/** 读取指定角色的结构化草稿。 */
export async function loadCharacterDraft(characterId: string): Promise<CharacterDraft> {
  const database = await getCharacterDatabase();
  const row = database
    .prepare('SELECT * FROM character_drafts WHERE character_id = ?')
    .get(characterId) as DatabaseRow | undefined;
  if (!row) return createEmptyCharacterDraft();
  return {
    ageAndBuild: readText(row.age_and_build),
    backgroundRules: readText(row.background_rules),
    characterPalette: readText(row.character_palette),
    characterSeed: readText(row.character_seed),
    colorRules: readText(row.color_rules),
    defaultOutfit: readText(row.default_outfit),
    detailDensity: readText(row.detail_density),
    exclusions: readText(row.exclusions),
    faceAnchor: readText(row.face_anchor),
    hairAnchor: readText(row.hair_anchor),
    lineAndShape: readText(row.line_and_shape),
    name: readText(row.name),
    signatureItems: readText(row.signature_items),
    silhouetteMarkers: readText(row.silhouette_markers),
    textRules: readText(row.text_rules),
    visualMedium: readText(row.visual_medium),
    visualSummary: readText(row.visual_summary),
  };
}

/** 角色改名时同步草稿中的名称字段。 */
export async function updateCharacterDraftName(characterId: string, name: string): Promise<void> {
  const database = await getCharacterDatabase();
  database
    .prepare('UPDATE character_drafts SET name = ? WHERE character_id = ?')
    .run(name, characterId);
}

// 串行执行 callback，对 store 做不可变更新 + 持久化；返回更新后的 store
export async function mutateStore(
  mutation: (
    store: StoredCharacterLibrary,
  ) => Promise<StoredCharacterLibrary> | StoredCharacterLibrary,
): Promise<StoredCharacterLibrary> {
  let result: StoredCharacterLibrary | null = null;
  const operation = mutationQueue.then(async () => {
    result = await mutation(await loadStore());
    await saveStore(result);
  });
  mutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  await operation;
  if (!result) {
    throw new Error('角色资料更新失败');
  }
  return result;
}

export function buildNewCharacter(name: string): CharacterSummary {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    id: createCharacterId(),
    name,
    updatedAt: now,
  };
}

async function getCharacterDatabase(): Promise<DatabaseSync> {
  const database = await getWorkspaceDatabase();
  if (!initializedDatabases.has(database)) {
    runDatabaseMigrations(database, CHARACTER_LIBRARY_MIGRATIONS);
    initializedDatabases.add(database);
  }
  return database;
}

function readCharacters(database: DatabaseSync): CharacterSummary[] {
  const rows = database
    .prepare('SELECT id, name, created_at, updated_at FROM characters ORDER BY created_at DESC')
    .all() as DatabaseRow[];
  return rows.map(row => ({
    createdAt: readText(row.created_at),
    id: readText(row.id),
    name: readText(row.name),
    updatedAt: readText(row.updated_at),
  }));
}

function saveCharacter(database: DatabaseSync, character: CharacterSummary): void {
  database
    .prepare(
      `INSERT INTO characters (id, name, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         updated_at = excluded.updated_at`,
    )
    .run(character.id, character.name, character.createdAt, character.updatedAt);
}

function insertDraft(database: DatabaseSync, characterId: string, name: string): void {
  database
    .prepare('INSERT OR IGNORE INTO character_drafts (character_id, name) VALUES (?, ?)')
    .run(characterId, name);
}

function saveActiveCharacter(database: DatabaseSync, characterId: string): void {
  database
    .prepare(
      `INSERT INTO character_library_state (id, active_character_id)
       VALUES (1, ?)
       ON CONFLICT (id) DO UPDATE SET active_character_id = excluded.active_character_id`,
    )
    .run(characterId);
}

function readText(value: SQLOutputValue | undefined): string {
  return typeof value === 'string' ? value : '';
}
