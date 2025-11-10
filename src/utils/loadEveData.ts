import type { SolarSystem, Region, Stargate } from '../lib/types';

export interface Constellation {
  _key: number;
  name: { [key: string]: string };
  position: { x: number; y: number; z: number };
  regionID: number;
  solarSystemIDs: number[];
}

// 重新导出类型以便demo使用
export type { SolarSystem, Region, Stargate };

/**
 * 解析JSONL文件
 */
async function parseJSONL<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.trim().split('\n');
  return lines.map(line => JSON.parse(line) as T);
}

const DATA_DIR = '/data';

/**
 * 加载太阳系数据
 */
export async function loadSolarSystems(): Promise<SolarSystem[]> {
  return parseJSONL<SolarSystem>(`${DATA_DIR}/mapSolarSystems.jsonl`);
}

/**
 * 加载区域数据
 */
export async function loadRegions(): Promise<Region[]> {
  return parseJSONL<Region>(`${DATA_DIR}/mapRegions.jsonl`);
}

/**
 * 加载星座数据
 */
export async function loadConstellations(): Promise<Constellation[]> {
  return parseJSONL<Constellation>(`${DATA_DIR}/mapConstellations.jsonl`);
}

/**
 * 加载星门数据
 */
export async function loadStargates(): Promise<Stargate[]> {
  return parseJSONL<Stargate>(`${DATA_DIR}/mapStargates.jsonl`);
}


