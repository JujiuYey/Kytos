/**
 * 桥梁基本信息表
 */
export const bridge = `
  CREATE TABLE IF NOT EXISTS bridge (
    id TEXT PRIMARY KEY,

    -- 项目ID
    project_id TEXT NOT NULL,
    
    -- A 桥梁所处行政区划代码
    admin_code TEXT NOT NULL,
    
    -- B 行政识别数据
    route_code TEXT NOT NULL,
    route_name TEXT NOT NULL,
    route_level TEXT NOT NULL,
    bridge_number TEXT NOT NULL,
    bridge_name TEXT NOT NULL,
    bridge_stake TEXT,
    function_type TEXT,
    crossed_road_name TEXT,
    crossed_road_stake TEXT,
    design_load TEXT,
    bridge_slope REAL,
    curve_radius REAL,
    completion_date TEXT,
    design_unit TEXT,
    construction_unit TEXT,
    supervision_unit TEXT,
    owner_unit TEXT,
    maintenance_unit TEXT,
    
    -- 系统字段
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    -- 唯一约束
    UNIQUE(bridge_number, bridge_name)
  )`;
