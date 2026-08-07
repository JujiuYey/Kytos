// API Key 使用系统安全存储加密后持久化到应用级 SQLite
import { safeStorage } from 'electron';
import { isPlainObject } from 'es-toolkit';
import type {
  CredentialService,
  CredentialStatus,
  SetCredentialRequest,
} from '../../shared/desktop';
import { getApplicationDatabase } from '../storage/app-database';

const credentialServices: CredentialService[] = ['apimart', 'deepseek', 'minimax'];

const credentialServiceLabels: Record<CredentialService, string> = {
  apimart: 'APIMart',
  deepseek: 'DeepSeek',
  minimax: 'MiniMax',
};

function getEncryptedCredential(service: CredentialService): string | null {
  const row = getApplicationDatabase()
    .prepare('SELECT encrypted_value FROM credentials WHERE service = ?')
    .get(service) as { encrypted_value?: unknown } | undefined;
  return typeof row?.encrypted_value === 'string' ? row.encrypted_value : null;
}

function saveEncryptedCredential(service: CredentialService, encryptedValue: string): void {
  getApplicationDatabase()
    .prepare(
      `INSERT INTO credentials (service, encrypted_value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT (service) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         updated_at = excluded.updated_at`,
    )
    .run(service, encryptedValue, new Date().toISOString());
}

export async function getCredentialValue(service: CredentialService): Promise<string> {
  const encryptedValue = getEncryptedCredential(service);
  if (!encryptedValue) {
    throw new Error(`尚未配置 ${credentialServiceLabels[service]} API Key`);
  }
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('系统安全存储不可用，无法读取 API Key');
  }
  const decrypted = await safeStorage.decryptStringAsync(Buffer.from(encryptedValue, 'base64'));
  if (decrypted.shouldReEncrypt) {
    const refreshedValue = await safeStorage.encryptStringAsync(decrypted.result);
    saveEncryptedCredential(service, refreshedValue.toString('base64'));
  }
  return decrypted.result;
}

export function isCredentialService(value: unknown): value is CredentialService {
  return credentialServices.includes(value as CredentialService);
}

export async function getCredentialStatus(service: CredentialService): Promise<CredentialStatus> {
  return {
    configured: Boolean(getEncryptedCredential(service)),
    secureStorageAvailable: safeStorage.isEncryptionAvailable(),
    service,
  };
}

export async function setCredential(request: SetCredentialRequest): Promise<CredentialStatus> {
  if (!isPlainObject(request) || !isCredentialService(request.service)) {
    throw new Error('凭据类型无效');
  }
  if (typeof request.value !== 'string' || !request.value.trim()) {
    throw new Error('API Key 不能为空');
  }
  if (request.value.length > 16_384) throw new Error('API Key 长度无效');
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('系统安全存储不可用，无法安全保存 API Key');
  }
  const encryptedValue = await safeStorage.encryptStringAsync(request.value.trim());
  saveEncryptedCredential(request.service, encryptedValue.toString('base64'));
  return getCredentialStatus(request.service);
}

export async function deleteCredential(service: CredentialService): Promise<CredentialStatus> {
  getApplicationDatabase().prepare('DELETE FROM credentials WHERE service = ?').run(service);
  return getCredentialStatus(service);
}
