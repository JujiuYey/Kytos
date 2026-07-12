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
 * 结构类型
 */
export interface StructSection {
  title: string;
  key: string;
  icon: any;
}

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
