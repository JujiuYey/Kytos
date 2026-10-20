// 厂商账户信息 provider：各厂商的余额、可用模型与消费用量接口
import { net } from 'electron';
import { isPlainObject } from 'es-toolkit';
import type {
  CredentialService,
  ProviderBalance,
  ProviderUsageBreakdown,
  ProviderUsageDay,
  ProviderUsageSummary,
} from '../../shared/desktop';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../constants/api';
import { describeNetworkError } from '../utils/http';

interface AccountProvider {
  // 余额接口地址
  balanceUrl: string;
  // 解析余额响应
  parseBalance: (payload: unknown) => ProviderBalance | null;
  // 模型列表接口地址，不支持时省略
  modelsUrl?: string;
  // 消费用量接口地址，不支持时省略
  usageUrl?: string;
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// 只有列在这里的厂商才有账户信息接口；各可选接口按厂商能力配置
const accountProviders: Partial<Record<CredentialService, AccountProvider>> = {
  apimart: {
    balanceUrl: `${API_BASE_URL}/v1/balance`,
    parseBalance: parseApimartBalance,
    usageUrl: `${API_BASE_URL}/v1/usage`,
  },
  deepseek: {
    balanceUrl: `${DEEPSEEK_BASE_URL}/user/balance`,
    modelsUrl: `${DEEPSEEK_BASE_URL}/models`,
    parseBalance: parseDeepSeekBalance,
  },
};

function getAccountProvider(service: CredentialService): AccountProvider {
  const provider = accountProviders[service];
  if (!provider) {
    throw new Error('该厂商暂不支持账户信息');
  }
  return provider;
}

export function isBalanceSupported(service: CredentialService): boolean {
  return Boolean(accountProviders[service]);
}

export function isModelsSupported(service: CredentialService): boolean {
  return Boolean(accountProviders[service]?.modelsUrl);
}

export function isUsageSupported(service: CredentialService): boolean {
  return Boolean(accountProviders[service]?.usageUrl);
}

/** 拉取厂商可用模型 id 列表。 */
export async function fetchProviderModels(
  service: CredentialService,
  apiKey: string,
): Promise<string[]> {
  const modelsUrl = getAccountProvider(service).modelsUrl;
  if (!modelsUrl) {
    throw new Error('该厂商暂不支持模型列表');
  }
  const payload = await requestAccountApi(modelsUrl, apiKey);
  return parseModelIds(payload);
}

/** 拉取厂商近 30 天消费用量：合计与按自然日的逐日明细。 */
export async function fetchProviderUsage(
  service: CredentialService,
  apiKey: string,
): Promise<ProviderUsageBreakdown> {
  const usageUrl = getAccountProvider(service).usageUrl;
  if (!usageUrl) {
    throw new Error('该厂商暂不支持用量查询');
  }
  // 接口只收秒级时间戳，范围上限 31 天
  const endMs = Date.now();
  const startMs = endMs - 30 * 24 * 3600 * 1000;
  const payload = await requestAccountApi(
    `${usageUrl}?start=${Math.floor(startMs / 1000)}&end=${Math.floor(endMs / 1000)}&group_by=date`,
    apiKey,
  );
  return parseUsage(payload, startMs, endMs);
}

/** 拉取厂商账户余额。 */
export async function fetchProviderBalance(
  service: CredentialService,
  apiKey: string,
): Promise<ProviderBalance> {
  const provider = getAccountProvider(service);
  const payload = await requestAccountApi(provider.balanceUrl, apiKey);
  const balance = provider.parseBalance(payload);
  if (!balance) {
    throw new Error('余额接口返回了无法识别的数据');
  }
  return balance;
}

// GET 厂商接口：走 Chromium 网络栈（自动跟随系统代理），Bearer 认证，统一超时与错误文案
async function requestAccountApi(url: string, apiKey: string): Promise<unknown> {
  let response: Response;
  try {
    response = await net.fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    throw new Error(`无法连接厂商接口：${describeNetworkError(error)}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`厂商接口返回了无法解析的响应（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    throw new Error(getAccountErrorMessage(payload, response.status));
  }
  return payload;
}

function getAccountErrorMessage(payload: unknown, status: number): string {
  if (status === 401) return 'API Key 无效或已失效';
  if (status === 402) return '账户余额不足';
  if (status === 429) return '请求过于频繁，请稍后再试';
  if (
    isPlainObject(payload) &&
    isPlainObject(payload.error) &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
  }
  return `厂商接口请求失败（HTTP ${status}）`;
}

// OpenAI 风格模型列表：{ data: [{ id }] }
function parseModelIds(payload: unknown): string[] {
  if (!isPlainObject(payload) || !Array.isArray(payload.data)) {
    return [];
  }
  const ids = payload.data
    .filter(item => isPlainObject(item))
    .map(item => (typeof item.id === 'string' ? item.id : ''))
    .filter(id => id.length > 0);
  return [...new Set(ids)];
}

// DeepSeek 余额：{ is_available, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
function parseDeepSeekBalance(payload: unknown): ProviderBalance | null {
  if (!isPlainObject(payload) || !Array.isArray(payload.balance_infos)) {
    return null;
  }
  const info = payload.balance_infos.find(item => isPlainObject(item));
  if (!info) {
    return null;
  }
  return {
    available: payload.is_available !== false,
    currency: typeof info.currency === 'string' ? info.currency : 'CNY',
    granted: typeof info.granted_balance === 'string' ? info.granted_balance : null,
    toppedUp: typeof info.topped_up_balance === 'string' ? info.topped_up_balance : null,
    total: typeof info.total_balance === 'string' ? info.total_balance : '0',
    unlimited: false,
    used: null,
  };
}

// APIMart 令牌余额：{ success, remain_balance, remain_credits, used_balance, used_credits, unlimited_quota }
// 文档：https://docs.apimart.ai/cn/api-reference/account/token-balance
// balance 字段的单位由站点配置决定（多为 USD），credits 字段恒为积分；
// 界面统一按积分展示，优先取 credits，缺省时退回 balance
function parseApimartBalance(payload: unknown): ProviderBalance | null {
  if (!isPlainObject(payload)) {
    return null;
  }
  // 业务失败时 HTTP 仍是 200，把 message 透传给界面
  if (payload.success === false) {
    throw new Error(typeof payload.message === 'string' ? payload.message : '查询令牌余额失败');
  }
  const unlimited = payload.unlimited_quota === true;
  const total = pickNumber(payload.remain_credits) ?? pickNumber(payload.remain_balance);
  const used = pickNumber(payload.used_credits) ?? pickNumber(payload.used_balance);
  if (!unlimited && total === null && used === null) {
    return null;
  }
  return {
    available: unlimited || (total ?? 0) > 0,
    currency: 'CREDITS',
    granted: null,
    toppedUp: null,
    total: total === null ? '0' : String(total),
    unlimited,
    used: used === null ? null : String(used),
  };
}

// 数值型字段才采纳，其余视为缺失
function pickNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

// APIMart 消费用量：{ success, data: { total: {...}, items: [{ date, credits, requests, ... }] } }
// 文档：https://docs.apimart.ai/cn/api-reference/account/usage
// group_by=date 按站点默认时区（Asia/Shanghai）划分自然日；credits 与官网展示单位一致；
// 503 usage_unavailable 表示查询不可用而非消费为 0
function parseUsage(payload: unknown, startMs: number, endMs: number): ProviderUsageBreakdown {
  if (!isPlainObject(payload) || !isPlainObject(payload.data)) {
    throw new Error('用量接口返回了无法识别的数据');
  }
  if (payload.success === false) {
    const message =
      isPlainObject(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : '查询用量失败';
    throw new Error(message);
  }
  const items = Array.isArray(payload.data.items) ? payload.data.items : [];
  const days = items.map(parseUsageDay).filter((day): day is ProviderUsageDay => day !== null);
  return {
    days: fillUsageDays(days, startMs, endMs),
    total: readUsageSummary(payload.data.total) ?? sumUsageDays(days),
  };
}

function parseUsageDay(value: unknown): ProviderUsageDay | null {
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

// 站点自然日固定按 Asia/Shanghai（UTC+8）划分，展开日期只用固定偏移
const USAGE_TZ_OFFSET_MS = 8 * 3600 * 1000;

function getUsageDateKey(timeMs: number): string {
  return new Date(timeMs + USAGE_TZ_OFFSET_MS).toISOString().slice(0, 10);
}

// 接口只返回有消费的日子，把 30 天窗口展开成连续日期，缺的日子补 0
function fillUsageDays(
  days: ProviderUsageDay[],
  startMs: number,
  endMs: number,
): ProviderUsageDay[] {
  const byDate = new Map(days.map(day => [day.date, day]));
  const filled: ProviderUsageDay[] = [];
  for (let timeMs = endMs; ; timeMs -= 24 * 3600 * 1000) {
    const date = getUsageDateKey(timeMs);
    const day = byDate.get(date);
    filled.unshift({ credits: day?.credits ?? 0, date, requests: day?.requests ?? 0 });
    if (date <= getUsageDateKey(startMs)) {
      return filled;
    }
  }
}
