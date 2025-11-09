// 加载EVE SDE数据工具函数

export interface SolarSystem {
  _key: number;
  name: { [key: string]: string };
  position: { x: number; y: number; z: number };
  regionID: number;
  constellationID: number;
  securityStatus: number;
  securityClass?: string;
}

export interface Region {
  _key: number;
  name: { [key: string]: string };
  position: { x: number; y: number; z: number };
  constellationIDs: number[];
}

export interface Constellation {
  _key: number;
  name: { [key: string]: string };
  position: { x: number; y: number; z: number };
  regionID: number;
  solarSystemIDs: number[];
}

export interface Stargate {
  _key: number;
  solarSystemID: number;
  destination: {
    solarSystemID: number;
    stargateID: number;
  };
  position: { x: number; y: number; z: number };
  typeID: number;
}

/**
 * 解析JSONL文件
 */
async function parseJSONL<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.trim().split('\n');
  return lines.map(line => JSON.parse(line) as T);
}

/**
 * 加载太阳系数据
 */
export async function loadSolarSystems(): Promise<SolarSystem[]> {
  return parseJSONL<SolarSystem>('/eve sde/mapSolarSystems.jsonl');
}

/**
 * 加载区域数据
 */
export async function loadRegions(): Promise<Region[]> {
  return parseJSONL<Region>('/eve sde/mapRegions.jsonl');
}

/**
 * 加载星座数据
 */
export async function loadConstellations(): Promise<Constellation[]> {
  return parseJSONL<Constellation>('/eve sde/mapConstellations.jsonl');
}

/**
 * 加载星门数据
 */
export async function loadStargates(): Promise<Stargate[]> {
  return parseJSONL<Stargate>('/eve sde/mapStargates.jsonl');
}

/**
 * 过滤New Eden太阳系（ID范围 30000000-30999999）
 */
export function isNewEdenSystem(systemID: number): boolean {
  return systemID >= 30000000 && systemID < 31000000;
}

