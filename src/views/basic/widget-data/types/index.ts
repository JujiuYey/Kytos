/**
 * 桥梁类型
 */
export interface BridgeType {
  id: string;
  name: string;
}

/**
 * 桥梁构件类型
 */
export type WidgetType = 'upper' | 'lower' | 'deck';

/**
 * 桥梁构件
 */
export interface Widget {
  id: string;
  /**
   * 构件名称
   */
  name: string;
  /**
   * 构件序号
   */
  sequence: number;
  /**
   * 构件重量
   */
  weight: number;
  /**
   * 构件类型
   */
  type: WidgetType;
  /**
   * 桥梁类型ID
   */
  bridgeTypeId: string;
}

/**
 * 病害
 */
export interface Disease {
  id: string;
  /**
   * 病害类型名称
   */
  name: string;
  /**
   * 病害类型序号
   */
  sequence: number;
  /**
   * 构件ID
   */
  widgetId: string;
}

/**
 * 病害等级
 */
export interface DiseaseLevel {
  id: string;
  /**
   * 标度
   */
  scale: number;
  /**
   * 病害ID
   */
  diseaseId: string;
  /**
   * 定量描述
   */
  quantifier: string;
  /**
   * 定性描述
   */
  qualitative: string;
}
