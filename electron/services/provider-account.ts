// 厂商账户信息：主进程用已存凭据拉取余额与可用模型，两类数据各自独立缓存
import { isPlainObject } from 'es-toolkit';
import type {
  CredentialService,
  ProviderBalance,
  ProviderBalanceResult,
  ProviderModelsResult,
  ProviderUsageBreakdown,
  ProviderUsageDay,
  ProviderUsageResult,
  ProviderUsageSummary,
} from '../../shared/desktop';
import {
  fetchProviderBalance,
  fetchProviderModels,
  fetchProviderUsage,
  isBalanceSupported,
  isModelsSupported,
  isUsageSupported,
} from '../providers/account-provider';
import { getApplicationDatabase } from '../storage/app-database';
import { getCredentialStatus, getCredentialValue } from './credentials';

type AccountKind = 'balance' | 'models' | 'usage';

interface CachedAccount {
  fetchedAt: string | null;
  payload: unknown;
}

/** 读取缓存的余额；未配置 Key 时返回空结果。 */
export async function getBalanceResult(service: CredentialService): Promise<ProviderBalanceResult> {
  if (!isBalanceSupported(service)) {
    return createBalanceResult(service, 'unsupported');
  }
  const status = await getCredentialStatus(service);
  if (!status.configured) {
    return createBalanceResult(service, 'not-configured');
  }
  const cached = readCachedAccount(service, 'balance');
  if (!cached) {
    return createBalanceResult(service, 'ok');
  }
  const balance = isPlainObject(cached.payload) ? (cached.payload as ProviderBalance) : null;
  return {
    balance,
    error: '',
    fetchedAt: cached.fetchedAt,
    service,
    state: 'ok',
  };
}

/** 读取缓存的可用模型；未配置 Key 时返回空结果。 */
export async function getModelsResult(service: CredentialService): Promise<ProviderModelsResult> {
  if (!isModelsSupported(service)) {
    return createModelsResult(service, 'unsupported');
  }
  const status = await getCredentialStatus(service);
  if (!status.configured) {
    return createModelsResult(service, 'not-configured');
  }
  const cached = readCachedAccount(service, 'models');
  if (!cached) {
    return createModelsResult(service, 'ok');
  }
  return {
    error: '',
    fetchedAt: cached.fetchedAt,
    models: Array.isArray(cached.payload)
      ? cached.payload.filter((id): id is string => typeof id === 'string')
      : [],
    service,
    state: 'ok',
  };
}

/** 重新拉取余额；失败时保留上一次缓存的数据与时间戳。 */
export async function refreshBalanceResult(
  service: CredentialService,
): Promise<ProviderBalanceResult> {
  if (!isBalanceSupported(service)) {
    return createBalanceResult(service, 'unsupported');
  }
  const status = await getCredentialStatus(service);
  if (!status.configured) {
    return createBalanceResult(service, 'not-configured');
  }

  let apiKey: string;
  try {
    apiKey = await getCredentialValue(service);
  } catch (error: unknown) {
    return createBalanceResult(service, 'error', toErrorMessage(error));
  }

  try {
    const balance = await fetchProviderBalance(service, apiKey);
    const fetchedAt = new Date().toISOString();
    saveCachedAccount(service, 'balance', balance, fetchedAt);
    return { balance, error: '', fetchedAt, service, state: 'ok' };
  } catch (error: unknown) {
    const cached = readCachedAccount(service, 'balance');
    return {
      balance: cached && isPlainObject(cached.payload) ? (cached.payload as ProviderBalance) : null,
      error: toErrorMessage(error),
      fetchedAt: cached?.fetchedAt ?? null,
      service,
      state: 'error',
    };
  }
}

/** 重新拉取可用模型；失败时保留上一次缓存的数据与时间戳。 */
export async function refreshModelsResult(
  service: CredentialService,
): Promise<ProviderModelsResult> {
  if (!isModelsSupported(service)) {
    return createModelsResult(service, 'unsupported');
  }
  const status = await getCredentialStatus(service);
  if (!status.configured) {
    return createModelsResult(service, 'not-configured');
  }

  let apiKey: string;
  try {
    apiKey = await getCredentialValue(service);
  } catch (error: unknown) {
    return createModelsResult(service, 'error', toErrorMessage(error));
  }

  try {
    const models = await fetchProviderModels(service, apiKey);
    const fetchedAt = new Date().toISOString();
    saveCachedAccount(service, 'models', models, fetchedAt);
    return { error: '', fetchedAt, models, service, state: 'ok' };
  } catch (error: unknown) {
    const cached = readCachedAccount(service, 'models');
    return {
      error: toErrorMessage(error),
      fetchedAt: cached?.fetchedAt ?? null,
      models: Array.isArray(cached?.payload)
        ? cached.payload.filter((id): id is string => typeof id === 'string')
        : [],
      service,
      state: 'error',
    };
  }
}

/** 读取缓存的消费用量；未配置 Key 时返回空结果。 */
export async function getUsageResult(service: CredentialService): Promise<ProviderUsageResult> {
  if (!isUsageSupported(service)) {
    return createUsageResult(service, 'unsupported');
  }
  const status = await getCredentialStatus(service);
  if (!status.configured) {
    return createUsageResult(service, 'not-configured');
  }
  const cached = readCachedAccount(service, 'usage');
  if (!cached) {
    return createUsageResult(service, 'ok');
  }
  const breakdown = readUsage(cached.payload);
  return {
    days: breakdown.days,
    error: '',
    fetchedAt: cached.fetchedAt,
    service,
    state: 'ok',
    total: breakdown.total,
  };
}

/** 重新拉取消费用量（近 30 天逐日明细）；失败时保留上一次缓存的数据与时间戳。 */
export async function refreshUsageResult(service: CredentialService): Promise<ProviderUsageResult> {
  if (!isUsageSupported(service)) {
    return createUsageResult(service, 'unsupported');
  }
  const status = await getCredentialStatus(service);
  if (!status.configured) {
    return createUsageResult(service, 'not-configured');
  }

  let apiKey: string;
  try {
    apiKey = await getCredentialValue(service);
  } catch (error: unknown) {
    return createUsageResult(service, 'error', toErrorMessage(error));
  }

  try {
    const breakdown = await fetchProviderUsage(service, apiKey);
    const fetchedAt = new Date().toISOString();
    saveCachedAccount(service, 'usage', breakdown, fetchedAt);
    return {
      days: breakdown.days,
      error: '',
      fetchedAt,
      service,
      state: 'ok',
      total: breakdown.total,
    };
  } catch (error: unknown) {
    const cached = readCachedAccount(service, 'usage');
    const breakdown = cached ? readUsage(cached.payload) : null;
    return {
      days: breakdown?.days ?? [],
      error: toErrorMessage(error),
      fetchedAt: cached?.fetchedAt ?? null,
      service,
      state: 'error',
      total: breakdown?.total ?? null,
    };
  }
}

// 缓存的用量 payload 形状收敛：{ total, days } 各自可缺失
function readUsage(payload: unknown): ProviderUsageBreakdown {
  if (!isPlainObject(payload)) {
    return { days: [], total: { credits: 0, requests: 0 } };
  }
  const days = Array.isArray(payload.days)
    ? payload.days.map(readUsageDay).filter((day): day is ProviderUsageDay => day !== null)
    : [];
  return { days, total: readUsageSummary(payload.total) ?? sumUsageDays(days) };
}

function readUsageDay(value: unknown): ProviderUsageDay | null {
  if (
    !isPlainObject(value) ||
    typeof value.date !== 'string' ||
    typeof value.credits !== 'number' ||
    typeof value.requests !== 'number'
  ) {
    return null;
  }
  return { credits: value.credits, date: value.date, requests: value.requests };
}

function readUsageSummary(value: unknown): ProviderUsageSummary | null {
  if (
    !isPlainObject(value) ||
    typeof value.credits !== 'number' ||
    typeof value.requests !== 'number'
  ) {
    return null;
  }
  return { credits: value.credits, requests: value.requests };
}

function sumUsageDays(days: ProviderUsageDay[]): ProviderUsageSummary {
  return days.reduce(
    (sum, day) => ({ credits: sum.credits + day.credits, requests: sum.requests + day.requests }),
    { credits: 0, requests: 0 },
  );
}

function createBalanceResult(
  service: CredentialService,
  state: ProviderBalanceResult['state'],
  error = '',
): ProviderBalanceResult {
  return { balance: null, error, fetchedAt: null, service, state };
}

function createModelsResult(
  service: CredentialService,
  state: ProviderModelsResult['state'],
  error = '',
): ProviderModelsResult {
  return { error, fetchedAt: null, models: [], service, state };
}

function createUsageResult(
  service: CredentialService,
  state: ProviderUsageResult['state'],
  error = '',
): ProviderUsageResult {
  return { days: [], error, fetchedAt: null, service, state, total: null };
}

function readCachedAccount(service: CredentialService, kind: AccountKind): CachedAccount | null {
  const row = getApplicationDatabase()
    .prepare(
      'SELECT payload, fetched_at FROM provider_account_snapshots WHERE service = ? AND kind = ?',
    )
    .get(service, kind) as { payload?: unknown; fetched_at?: unknown } | undefined;
  if (!row || typeof row.payload !== 'string') {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(row.payload);
    return {
      fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : null,
      payload,
    };
  } catch {
    return null;
  }
}

function saveCachedAccount(
  service: CredentialService,
  kind: AccountKind,
  payload: unknown,
  fetchedAt: string,
): void {
  getApplicationDatabase()
    .prepare(
      `INSERT INTO provider_account_snapshots (service, kind, payload, fetched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (service, kind) DO UPDATE SET
         payload = excluded.payload,
         fetched_at = excluded.fetched_at`,
    )
    .run(service, kind, JSON.stringify(payload), fetchedAt);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
