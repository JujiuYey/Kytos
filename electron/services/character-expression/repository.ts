// 角色表情的 SQLite 仓储
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type {
  CharacterExpressionRecord,
  CharacterExpressionReferenceSelection,
  CharacterExpressionTask,
  CharacterExpressionWorkspaceState,
} from '../../../shared/character-expression';
import {
  getWorkspaceDatabase,
  runDatabaseMigrations,
  runInTransaction,
} from '../../storage/database';
import { getExpressionAssetUrl, parseExpressionRecord, parseExpressionTask } from './parsers';
import { CHARACTER_EXPRESSION_MIGRATIONS } from './schema';

const initializedDatabases = new WeakSet<DatabaseSync>();

type DatabaseRow = Record<string, SQLOutputValue>;

/** 列出指定角色的正式表情和未完成任务。 */
export async function getExpressionWorkspace(
  characterId: string,
): Promise<CharacterExpressionWorkspaceState> {
  const database = await getExpressionDatabase();
  return {
    records: readRecords(database, characterId),
    tasks: readTasks(database, characterId),
  };
}

/** 查询一条正式表情记录。 */
export async function findExpressionRecord(
  characterId: string,
  recordId: string,
): Promise<CharacterExpressionRecord | null> {
  const database = await getExpressionDatabase();
  return readRecord(database, characterId, recordId);
}

/** 新增或完整替换一条正式表情记录。 */
export async function saveExpressionRecord(
  characterId: string,
  record: CharacterExpressionRecord,
): Promise<void> {
  const database = await getExpressionDatabase();
  runInTransaction(database, () => saveRecord(database, characterId, record));
}

/** 更新正式表情名称。 */
export async function renameExpressionRecord(
  characterId: string,
  recordId: string,
  name: string,
  updatedAt: string,
): Promise<boolean> {
  const database = await getExpressionDatabase();
  const result = database
    .prepare(
      `UPDATE character_expression_records
       SET name = ?, updated_at = ?
       WHERE character_id = ? AND id = ?`,
    )
    .run(name, updatedAt, characterId, recordId);
  return result.changes > 0;
}

/** 删除一张表情图片；最后一张图片被删除时同时删除记录。 */
export async function removeExpressionImage(
  characterId: string,
  recordId: string,
  fileName: string,
  updatedAt: string,
): Promise<CharacterExpressionRecord | null> {
  const database = await getExpressionDatabase();
  const record = readRecord(database, characterId, recordId);
  if (!record?.images.some(image => image.fileName === fileName)) return null;

  runInTransaction(database, () => {
    if (record.images.length === 1) {
      database
        .prepare('DELETE FROM character_expression_records WHERE character_id = ? AND id = ?')
        .run(characterId, recordId);
      return;
    }
    database
      .prepare(
        `DELETE FROM character_expression_images
         WHERE character_id = ? AND record_id = ? AND file_name = ?`,
      )
      .run(characterId, recordId, fileName);
    database
      .prepare(
        `UPDATE character_expression_records
         SET updated_at = ?
         WHERE character_id = ? AND id = ?`,
      )
      .run(updatedAt, characterId, recordId);
  });
  return record;
}

/** 查询一条表情生成任务。 */
export async function findExpressionTask(
  characterId: string,
  taskId: string,
): Promise<CharacterExpressionTask | null> {
  const database = await getExpressionDatabase();
  return readTask(database, characterId, taskId);
}

/** 新增或完整替换一条表情生成任务。 */
export async function saveExpressionTask(
  characterId: string,
  task: CharacterExpressionTask,
): Promise<void> {
  const database = await getExpressionDatabase();
  runInTransaction(database, () => saveTask(database, characterId, task));
}

/** 删除一条表情生成任务。 */
export async function deleteExpressionTask(characterId: string, taskId: string): Promise<void> {
  const database = await getExpressionDatabase();
  database
    .prepare('DELETE FROM character_expression_tasks WHERE character_id = ? AND id = ?')
    .run(characterId, taskId);
}

/** 原子地把生成任务转换为正式表情，避免任务和资产出现半完成状态。 */
export async function completeExpressionTask(
  characterId: string,
  record: CharacterExpressionRecord,
): Promise<void> {
  const database = await getExpressionDatabase();
  runInTransaction(database, () => {
    saveRecord(database, characterId, record);
    database
      .prepare('DELETE FROM character_expression_tasks WHERE character_id = ? AND id = ?')
      .run(characterId, record.id);
  });
}

async function getExpressionDatabase(): Promise<DatabaseSync> {
  const database = await getWorkspaceDatabase();
  if (!initializedDatabases.has(database)) {
    runDatabaseMigrations(database, CHARACTER_EXPRESSION_MIGRATIONS);
    initializedDatabases.add(database);
  }
  return database;
}

function saveRecord(
  database: DatabaseSync,
  characterId: string,
  record: CharacterExpressionRecord,
): void {
  database
    .prepare(
      `INSERT INTO character_expression_records (
         character_id, id, name, description, count, prompt, resolution, size,
         source, original_name, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (character_id, id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         count = excluded.count,
         prompt = excluded.prompt,
         resolution = excluded.resolution,
         size = excluded.size,
         source = excluded.source,
         original_name = excluded.original_name,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
    )
    .run(
      characterId,
      record.id,
      record.name,
      record.description,
      record.count,
      record.prompt,
      record.resolution,
      record.size,
      record.source,
      record.originalName,
      record.createdAt,
      record.updatedAt,
    );
  database
    .prepare('DELETE FROM character_expression_images WHERE character_id = ? AND record_id = ?')
    .run(characterId, record.id);
  database
    .prepare(
      'DELETE FROM character_expression_record_references WHERE character_id = ? AND record_id = ?',
    )
    .run(characterId, record.id);

  const insertImage = database.prepare(
    `INSERT INTO character_expression_images (
       character_id, record_id, position, file_name, mime_type, name
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  record.images.forEach((image, position) => {
    insertImage.run(
      characterId,
      record.id,
      position,
      image.fileName,
      image.mimeType,
      image.name ?? null,
    );
  });
  saveRecordReferences(database, characterId, record.id, record.referenceAssets);
}

function saveRecordReferences(
  database: DatabaseSync,
  characterId: string,
  recordId: string,
  references: CharacterExpressionReferenceSelection[],
): void {
  const insertReference = database.prepare(
    `INSERT INTO character_expression_record_references (
       character_id, record_id, position, kind, task_id, file_name
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  references.forEach((reference, position) => {
    insertReference.run(
      characterId,
      recordId,
      position,
      reference.kind,
      reference.taskId,
      reference.fileName,
    );
  });
}

function saveTask(
  database: DatabaseSync,
  characterId: string,
  task: CharacterExpressionTask,
): void {
  database
    .prepare(
      `INSERT INTO character_expression_tasks (
         character_id, id, name, description, count, prompt, resolution, size,
         status, progress, error_message, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (character_id, id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         count = excluded.count,
         prompt = excluded.prompt,
         resolution = excluded.resolution,
         size = excluded.size,
         status = excluded.status,
         progress = excluded.progress,
         error_message = excluded.error_message,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
    )
    .run(
      characterId,
      task.id,
      task.name,
      task.description,
      task.count,
      task.prompt,
      task.resolution,
      task.size,
      task.status,
      task.progress,
      task.errorMessage,
      task.createdAt,
      task.updatedAt,
    );
  database
    .prepare(
      'DELETE FROM character_expression_task_references WHERE character_id = ? AND task_id = ?',
    )
    .run(characterId, task.id);

  const insertReference = database.prepare(
    `INSERT INTO character_expression_task_references (
       character_id, task_id, position, kind, reference_task_id, file_name
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  task.referenceAssets.forEach((reference, position) => {
    insertReference.run(
      characterId,
      task.id,
      position,
      reference.kind,
      reference.taskId,
      reference.fileName,
    );
  });
}

function readRecords(database: DatabaseSync, characterId: string): CharacterExpressionRecord[] {
  return database
    .prepare(
      `SELECT * FROM character_expression_records
       WHERE character_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(characterId)
    .map(row => mapRecord(database, row));
}

function readRecord(
  database: DatabaseSync,
  characterId: string,
  recordId: string,
): CharacterExpressionRecord | null {
  const row = database
    .prepare(
      `SELECT * FROM character_expression_records
       WHERE character_id = ? AND id = ?`,
    )
    .get(characterId, recordId);
  return row ? mapRecord(database, row) : null;
}

function mapRecord(database: DatabaseSync, row: DatabaseRow): CharacterExpressionRecord {
  const characterId = readText(row, 'character_id');
  const recordId = readText(row, 'id');
  const images = database
    .prepare(
      `SELECT file_name, mime_type, name FROM character_expression_images
       WHERE character_id = ? AND record_id = ?
       ORDER BY position`,
    )
    .all(characterId, recordId)
    .map(imageRow => {
      const fileName = readText(imageRow, 'file_name');
      const name = imageRow.name;
      return {
        fileName,
        mimeType: readText(imageRow, 'mime_type'),
        ...(typeof name === 'string' ? { name } : {}),
        url: getExpressionAssetUrl(fileName),
      };
    });
  const referenceAssets = readRecordReferences(database, characterId, recordId);
  const record = parseExpressionRecord({
    count: readNumber(row, 'count'),
    createdAt: readText(row, 'created_at'),
    description: readText(row, 'description'),
    errorMessage: null,
    id: recordId,
    images,
    name: readText(row, 'name'),
    originalName: readNullableText(row, 'original_name'),
    progress: 100,
    prompt: readText(row, 'prompt'),
    referenceAssets,
    resolution: readText(row, 'resolution'),
    size: readText(row, 'size'),
    source: readText(row, 'source'),
    status: 'completed',
    updatedAt: readText(row, 'updated_at'),
  });
  if (!record) throw new Error(`数据库中的表情记录无效：${recordId}`);
  return record;
}

function readRecordReferences(
  database: DatabaseSync,
  characterId: string,
  recordId: string,
): CharacterExpressionReferenceSelection[] {
  return database
    .prepare(
      `SELECT kind, task_id, file_name FROM character_expression_record_references
       WHERE character_id = ? AND record_id = ?
       ORDER BY position`,
    )
    .all(characterId, recordId)
    .map(row => ({
      fileName: readText(row, 'file_name'),
      kind: readReferenceKind(row, 'kind'),
      taskId: readText(row, 'task_id'),
    }));
}

function readTasks(database: DatabaseSync, characterId: string): CharacterExpressionTask[] {
  return database
    .prepare(
      `SELECT * FROM character_expression_tasks
       WHERE character_id = ?
       ORDER BY created_at DESC`,
    )
    .all(characterId)
    .map(row => mapTask(database, row));
}

function readTask(
  database: DatabaseSync,
  characterId: string,
  taskId: string,
): CharacterExpressionTask | null {
  const row = database
    .prepare(
      `SELECT * FROM character_expression_tasks
       WHERE character_id = ? AND id = ?`,
    )
    .get(characterId, taskId);
  return row ? mapTask(database, row) : null;
}

function mapTask(database: DatabaseSync, row: DatabaseRow): CharacterExpressionTask {
  const characterId = readText(row, 'character_id');
  const taskId = readText(row, 'id');
  const referenceAssets = database
    .prepare(
      `SELECT kind, reference_task_id, file_name
       FROM character_expression_task_references
       WHERE character_id = ? AND task_id = ?
       ORDER BY position`,
    )
    .all(characterId, taskId)
    .map(referenceRow => ({
      fileName: readText(referenceRow, 'file_name'),
      kind: readReferenceKind(referenceRow, 'kind'),
      taskId: readText(referenceRow, 'reference_task_id'),
    }));
  const task = parseExpressionTask({
    count: readNumber(row, 'count'),
    createdAt: readText(row, 'created_at'),
    description: readText(row, 'description'),
    errorMessage: readNullableText(row, 'error_message'),
    id: taskId,
    name: readText(row, 'name'),
    progress: readNumber(row, 'progress'),
    prompt: readText(row, 'prompt'),
    referenceAssets,
    resolution: readText(row, 'resolution'),
    size: readText(row, 'size'),
    status: readText(row, 'status'),
    updatedAt: readText(row, 'updated_at'),
  });
  if (!task) throw new Error(`数据库中的表情任务无效：${taskId}`);
  return task;
}

function readText(row: DatabaseRow, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') throw new Error(`数据库字段 ${column} 不是文本`);
  return value;
}

function readNullableText(row: DatabaseRow, column: string): string | null {
  const value = row[column];
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`数据库字段 ${column} 不是可空文本`);
  return value;
}

function readNumber(row: DatabaseRow, column: string): number {
  const value = row[column];
  if (typeof value !== 'number') throw new Error(`数据库字段 ${column} 不是数字`);
  return value;
}

function readReferenceKind(
  row: DatabaseRow,
  column: string,
): CharacterExpressionReferenceSelection['kind'] {
  const value = readText(row, column);
  if (value !== 'visual' && value !== 'expression') {
    throw new Error(`数据库字段 ${column} 不是有效的参考类型`);
  }
  return value;
}
