/**
 * 目录
 */
export interface Catalog {
  id: string;
  name: string;
  sequence: number;
  parentId: string | null;
  children?: Catalog[];
}

/**
 * 评估指标
 */
export interface AssessmentIndicator {
  id: string;
  name: string;
  sequence: number;
  catalogId: string;
  standards?: AssessmentStandard[];
}

/**
 * 评估标准
 */
export interface AssessmentStandard {
  id: string;
  /**
   * 标度
   */
  scale: number;
  /**
   * 指标
   */
  indicatorId: string;
  /**
   * 定性描述
   */
  qualitative: string;
  /**
   * 定量描述
   */
  quantifier: string;
}
