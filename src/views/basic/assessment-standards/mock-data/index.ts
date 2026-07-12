import type { AssessmentIndicator, Catalog } from '../types';

import { section_5_1 } from './indicator/section_5_1';
import { section_5_2 } from './indicator/section_5_2';
import { section_5_3 } from './indicator/section_5_3';
import { section_6_1 } from './indicator/section_6_1';
import { section_6_2 } from './indicator/section_6_2';
import { section_7_1 } from './indicator/section_7_1';
import { section_7_2 } from './indicator/section_7_2';
import { section_7_3 } from './indicator/section_7_3';
import { section_7_4 } from './indicator/section_7_4';
import { section_7_5 } from './indicator/section_7_5';
import { section_7_6 } from './indicator/section_7_6';
import { section_7_7 } from './indicator/section_7_7';
import { section_7_8 } from './indicator/section_7_8';
import { section_8_1 } from './indicator/section_8_1';
import { section_8_2 } from './indicator/section_8_2';
import { section_8_3 } from './indicator/section_8_3';
import { section_8_4 } from './indicator/section_8_4';
import { section_8_5 } from './indicator/section_8_5';
import { section_8_6 } from './indicator/section_8_6';

// Import catalog data
import { catalog_5 } from './catalog/catalog-5';
import { catalog_6 } from './catalog/catalog-6';
import { catalog_7 } from './catalog/catalog-7';
import { catalog_8 } from './catalog/catalog-8';
import { catalog_9 } from './catalog/catalog-9';
import { catalog_10 } from './catalog/catalog-10';

// Combine all catalog data
export const catalog: Catalog[] = [
  ...catalog_5,
  ...catalog_6,
  ...catalog_7,
  ...catalog_8,
  ...catalog_9,
  ...catalog_10,
];

export const assessmentIndicator: AssessmentIndicator[] = [
  ...section_5_1,
  ...section_5_2,
  ...section_5_3,
  ...section_6_1,
  ...section_6_2,
  ...section_7_1,
  ...section_7_2,
  ...section_7_3,
  ...section_7_4,
  ...section_7_5,
  ...section_7_6,
  ...section_7_7,
  ...section_7_8,
  ...section_8_1,
  ...section_8_2,
  ...section_8_3,
  ...section_8_4,
  ...section_8_5,
  ...section_8_6,
];
