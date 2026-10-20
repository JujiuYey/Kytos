// 厂商账户信息类型：余额、可用模型与拉取时间
import type { CredentialService } from './settings';

// 厂商余额
export interface ProviderBalance {
  // 账户余额是否仍可发起调用
  available: boolean;
  // 计费单位：CNY、USD 或 CREDITS（积分）
  currency: string;
  // 赠金余额，无赠金时为 null
  granted: string | null;
  // 充值余额，无充值记录时为 null
  toppedUp: string | null;
  // 可用总额
  total: string;
  // 是否为无限额度令牌；为 true 时 total 是接口原始值（-1），界面显示「无限额度」
  unlimited: boolean;
  // 已用额度，无该维度时为 null
  used: string | null;
}

// 账户信息状态
export type ProviderAccountState =
  // 拉取失败且没有任何可用数据
  | 'error'
  // 尚未配置该厂商的 API Key
  | 'not-configured'
  // 有数据
  | 'ok'
  // 该厂商没有这个接口
  | 'unsupported';

// 余额查询结果
export interface ProviderBalanceResult {
  // 余额，缺失时为 null
  balance: ProviderBalance | null;
  // 失败原因，空字符串表示成功
  error: string;
  // 最近一次成功拉取时间，ISO 字符串
  fetchedAt: string | null;
  // 厂商标识
  service: CredentialService;
  // 状态
  state: ProviderAccountState;
}

// 模型列表查询结果
export interface ProviderModelsResult {
  // 失败原因，空字符串表示成功
  error: string;
  // 最近一次成功拉取时间，ISO 字符串
  fetchedAt: string | null;
  // 可用模型 id
  models: string[];
  // 厂商标识
  service: CredentialService;
  // 状态
  state: ProviderAccountState;
}

// 消费用量合计（积分与官网展示单位一致）
export interface ProviderUsageSummary {
  // 消费金额（积分）
  credits: number;
  // 计费成功的调用次数
  requests: number;
}

// 单日消费用量（站点默认时区下的自然日）
export interface ProviderUsageDay {
  // 自然日，YYYY-MM-DD
  date: string;
  // 当日消费金额（积分）
  credits: number;
  // 当日计费成功的调用次数
  requests: number;
}

// 用量数据：近 30 天合计与逐日明细，即拉取结果与缓存载荷
export interface ProviderUsageBreakdown {
  // 近 30 天合计
  total: ProviderUsageSummary;
  // 逐日消费，按自然日升序，无消费的日子补 0
  days: ProviderUsageDay[];
}

// 用量查询结果
export interface ProviderUsageResult {
  // 失败原因，空字符串表示成功
  error: string;
  // 最近一次成功拉取时间，ISO 字符串
  fetchedAt: string | null;
  // 厂商标识
  service: CredentialService;
  // 状态
  state: ProviderAccountState;
  // 近 30 天合计，缺失时为 null
  total: ProviderUsageSummary | null;
  // 逐日消费，按自然日升序，缺失时为空数组
  days: ProviderUsageDay[];
}
