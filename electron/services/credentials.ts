import path from 'node:path';
import { app, safeStorage } from 'electron';
import type {
  CredentialService,
  CredentialStatus,
  SetCredentialRequest,
} from '../../shared/desktop';
import { readJsonFile, writeJsonFile } from './json-store';

interface StoredSecrets {
  credentials: Partial<Record<CredentialService, string>>;
  version: 1;
}

const credentialServices: CredentialService[] = ['apimart', 'deepseek'];

function getSecretsFilePath(): string {
  return path.join(app.getPath('userData'), 'secrets.json');
}

async function loadStoredSecrets(): Promise<StoredSecrets> {
  const value = await readJsonFile(getSecretsFilePath());
  const credentials: Partial<Record<CredentialService, string>> = {};

  if (value && typeof value === 'object' && 'credentials' in value) {
    const storedCredentials = value.credentials;
    if (storedCredentials && typeof storedCredentials === 'object') {
      for (const service of credentialServices) {
        if (service in storedCredentials) {
          const encryptedValue = (storedCredentials as Record<string, unknown>)[service];
          if (typeof encryptedValue === 'string') {
            credentials[service] = encryptedValue;
          }
        }
      }
    }
  }

  return { credentials, version: 1 };
}

export function isCredentialService(value: unknown): value is CredentialService {
  return credentialServices.includes(value as CredentialService);
}

export async function getCredentialStatus(service: CredentialService): Promise<CredentialStatus> {
  const secrets = await loadStoredSecrets();
  return {
    configured: Boolean(secrets.credentials[service]),
    secureStorageAvailable: safeStorage.isEncryptionAvailable(),
    service,
  };
}

export async function setCredential(request: SetCredentialRequest): Promise<CredentialStatus> {
  if (!request || typeof request !== 'object' || !isCredentialService(request.service)) {
    throw new Error('凭据类型无效');
  }
  if (typeof request.value !== 'string' || !request.value.trim()) {
    throw new Error('API Key 不能为空');
  }
  if (request.value.length > 16_384) {
    throw new Error('API Key 长度无效');
  }
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('系统安全存储不可用，无法安全保存 API Key');
  }

  const encryptedValue = await safeStorage.encryptStringAsync(request.value.trim());
  const secrets = await loadStoredSecrets();
  secrets.credentials[request.service] = encryptedValue.toString('base64');
  await writeJsonFile(getSecretsFilePath(), secrets);
  return getCredentialStatus(request.service);
}

export async function deleteCredential(service: CredentialService): Promise<CredentialStatus> {
  const secrets = await loadStoredSecrets();
  delete secrets.credentials[service];
  await writeJsonFile(getSecretsFilePath(), secrets);
  return getCredentialStatus(service);
}
