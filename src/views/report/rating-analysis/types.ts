// 病害记录数据类型
export interface DiseaseRecord {
  // 记录ID
  id: string;
  // 构件编号
  componentNumber: string;
  // 病害位置
  diseaseLocation: string;
  // 病害类型
  diseaseType: string;
  // 病害描述
  diseaseDescription: string;
  // 病害定量-数值
  quantityValue?: number;
  // 病害定量-单位
  quantityUnit: string;
  // 评定标准 1-5
  evaluationStandard?: number;
  // 照片编号
  photoNumber: string;
  // 照片文件
  photos: File[];
}
