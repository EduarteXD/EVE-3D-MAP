// EVE Map 3D 库工具函数

/**
 * 过滤New Eden太阳系（ID范围 30000000-30999999）
 */
export function isNewEdenSystem(systemID: number): boolean {
  return systemID >= 30000000 && systemID < 31000000;
}

