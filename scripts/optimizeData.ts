#!/usr/bin/env node
/**
 * EVE 星图数据优化脚本
 * 
 * 功能：
 * 1. 过滤出只需要的 New Eden 系统（ID: 30000000-30999999）
 * 2. 只保留与这些系统相关的星门连接
 * 3. 只保留包含 New Eden 系统的星域
 * 4. 移除不需要的字段，只保留代码中实际使用的字段
 * 5. 压缩数据格式
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SolarSystem } from '../src/utils/loadEveData';
import type { Stargate } from '../src/utils/loadEveData';
import type { Region } from '../src/utils/loadEveData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// New Eden 系统 ID 范围
const NEW_EDEN_MIN_ID = 30000000;
const NEW_EDEN_MAX_ID = 31000000;

// 输入和输出目录
const INPUT_DIR = join(__dirname, '../eve sde');
const OUTPUT_DIR = join(__dirname, '../public/data');

// 确保输出目录存在
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 判断是否为 New Eden 系统
 */
function isNewEdenSystem(systemID: number): boolean {
  return systemID >= NEW_EDEN_MIN_ID && systemID < NEW_EDEN_MAX_ID;
}

/**
 * 读取 JSONL 文件
 */
function readJSONL<T>(filePath: string): T[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line) as T);
}

/**
 * 写入 JSONL 文件
 */
function writeJSONL<T>(filePath: string, data: T[]): void {
  const lines = data.map(item => JSON.stringify(item));
  writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

/**
 * 优化太阳系数据
 */
function optimizeSolarSystems() {
  console.log('正在读取太阳系数据...');
  const systems = readJSONL<SolarSystem>(join(INPUT_DIR, 'mapSolarSystems.jsonl'));
  
  console.log(`原始数据: ${systems.length} 个系统`);
  
  // 过滤 New Eden 系统
  const newEdenSystems = systems.filter(s => isNewEdenSystem(s._key));
  console.log(`New Eden 系统: ${newEdenSystems.length} 个`);
  
  // 创建系统 ID 集合，用于后续过滤
  const systemIDSet = new Set(newEdenSystems.map(s => s._key));
  
  // 只保留需要的字段
  const optimized = newEdenSystems.map(system => ({
    _key: system._key,
    name: {
      zh: system.name?.zh || system.name?.en || '',
      en: system.name?.en || '',
      // ja: system.name?.ja || ''
    },
    position: {
      x: system.position.x,
      y: system.position.y,
      z: system.position.z
    },
    regionID: system.regionID,
    constellationID: system.constellationID,
    securityStatus: system.securityStatus,
    ...(system.securityClass ? { securityClass: system.securityClass } : {})
  }));
  
  // 写入优化后的数据
  writeJSONL(join(OUTPUT_DIR, 'mapSolarSystems.jsonl'), optimized);
  
  const originalSize = readFileSync(join(INPUT_DIR, 'mapSolarSystems.jsonl')).length;
  const optimizedSize = readFileSync(join(OUTPUT_DIR, 'mapSolarSystems.jsonl')).length;
  const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(2);
  
  console.log(`优化完成:`);
  console.log(`  原始大小: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  优化后大小: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  压缩率: ${reduction}%`);
  console.log(`  保留系统: ${optimized.length} / ${systems.length}`);
  
  return { systemIDSet, regionIDs: new Set(optimized.map(s => s.regionID)) };
}

/**
 * 优化星门数据
 */
function optimizeStargates(systemIDSet: Set<number>) {
  console.log('\n正在读取星门数据...');
  const stargates = readJSONL<Stargate>(join(INPUT_DIR, 'mapStargates.jsonl'));
  
  console.log(`原始数据: ${stargates.length} 个星门`);
  
  // 只保留两个端点都在 New Eden 的星门连接
  const optimized = stargates
    .filter(stargate => {
      const fromInNewEden = systemIDSet.has(stargate.solarSystemID);
      const toInNewEden = systemIDSet.has(stargate.destination?.solarSystemID);
      return fromInNewEden && toInNewEden;
    })
    .map(stargate => ({
      _key: stargate._key,
      solarSystemID: stargate.solarSystemID,
      destination: {
        solarSystemID: stargate.destination.solarSystemID,
        stargateID: stargate.destination.stargateID
      },
      position: {
        x: stargate.position.x,
        y: stargate.position.y,
        z: stargate.position.z
      },
      typeID: stargate.typeID
    }));
  
  // 写入优化后的数据
  writeJSONL(join(OUTPUT_DIR, 'mapStargates.jsonl'), optimized);
  
  const originalSize = readFileSync(join(INPUT_DIR, 'mapStargates.jsonl')).length;
  const optimizedSize = readFileSync(join(OUTPUT_DIR, 'mapStargates.jsonl')).length;
  const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(2);
  
  console.log(`优化完成:`);
  console.log(`  原始大小: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  优化后大小: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  压缩率: ${reduction}%`);
  console.log(`  保留星门: ${optimized.length} / ${stargates.length}`);
}

/**
 * 优化星域数据
 */
function optimizeRegions(regionIDSet: Set<number>) {
  console.log('\n正在读取星域数据...');
  const regions = readJSONL<Region>(join(INPUT_DIR, 'mapRegions.jsonl'));
  
  console.log(`原始数据: ${regions.length} 个星域`);
  
  // 只保留包含 New Eden 系统的星域
  const optimized = regions
    .filter(region => regionIDSet.has(region._key))
    .map(region => ({
      _key: region._key,
      name: {
        zh: region.name?.zh || region.name?.en || '',
        en: region.name?.en || ''
      },
      position: {
        x: region.position.x,
        y: region.position.y,
        z: region.position.z
      },
      constellationIDs: region.constellationIDs || []
    }));
  
  // 写入优化后的数据
  writeJSONL(join(OUTPUT_DIR, 'mapRegions.jsonl'), optimized);
  
  const originalSize = readFileSync(join(INPUT_DIR, 'mapRegions.jsonl')).length;
  const optimizedSize = readFileSync(join(OUTPUT_DIR, 'mapRegions.jsonl')).length;
  const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(2);
  
  console.log(`优化完成:`);
  console.log(`  原始大小: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  优化后大小: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  压缩率: ${reduction}%`);
  console.log(`  保留星域: ${optimized.length} / ${regions.length}`);
}

/**
 * 主函数
 */
function main() {
  console.log('开始优化 EVE 星图数据...\n');
  
  try {
    // 1. 优化太阳系数据
    const { systemIDSet, regionIDs } = optimizeSolarSystems();
    
    // 2. 优化星门数据
    optimizeStargates(systemIDSet);
    
    // 3. 优化星域数据
    optimizeRegions(regionIDs);
    
    console.log('\n✅ 数据优化完成！');
    console.log(`优化后的数据已保存到: ${OUTPUT_DIR}`);
    console.log('\n提示: 请更新代码中的数据文件路径，指向优化后的文件。');
    
  } catch (error) {
    console.error('❌ 优化过程中出现错误:', error);
    process.exit(1);
  }
}

main();

