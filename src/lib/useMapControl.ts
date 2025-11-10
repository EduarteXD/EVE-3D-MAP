import { useRef, useCallback } from 'react';
import type { MapControl } from './types';
import type { SolarSystem } from './types';

// OrbitControls 类型（简化版，用于类型安全）
interface OrbitControlsRef {
  target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  object: {
    position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  };
  update: () => void;
}

/**
 * 地图控制 Hook
 * 用于生成 mapControl 对象，传入 EveMap3D 组件来控制地图
 * 
 * @returns MapControl 对象，包含控制地图的方法
 * 
 * @example
 * ```tsx
 * function App() {
 *   const mapControl = useMapControl();
 *   
 *   return (
 *     <EveMap3D mapControl={mapControl} />
 *   );
 * }
 * ```
 */
export function useMapControl(): MapControl {
  const controlsRef = useRef<OrbitControlsRef | null>(null);
  const systemsRef = useRef<SolarSystem[]>([]);
  const initialCameraPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const initialCameraTargetRef = useRef<{ x: number; y: number; z: number } | null>(null);

  // 内部方法：设置 controls 引用（由 EveMap3D 组件调用）
  const setControlsRef = useCallback((ref: unknown) => {
    controlsRef.current = ref as OrbitControlsRef | null;
  }, []);

  // 内部方法：设置系统数据（由 EveMap3D 组件调用）
  const setSystems = useCallback((systems: SolarSystem[]) => {
    systemsRef.current = systems;
  }, []);

  // 内部方法：设置初始相机位置（由 EveMap3D 组件调用）
  const setInitialCameraPosition = useCallback((position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) => {
    initialCameraPositionRef.current = position;
    initialCameraTargetRef.current = target;
  }, []);

  // 重置相机到初始位置
  const resetCamera = useCallback(() => {
    if (!controlsRef.current || !initialCameraPositionRef.current || !initialCameraTargetRef.current) {
      return;
    }

    const { x: px, y: py, z: pz } = initialCameraPositionRef.current;
    const { x: tx, y: ty, z: tz } = initialCameraTargetRef.current;

    controlsRef.current.target.set(tx, ty, tz);
    controlsRef.current.object.position.set(px, py, pz);
    controlsRef.current.update();
  }, []);

  // 聚焦到指定系统
  const focusSystem = useCallback((systemId: number) => {
    if (!controlsRef.current) return;

    const system = systemsRef.current.find(s => s._key === systemId);
    if (!system) return;

    const { x, y, z } = system.position;
    const distance = 1e16; // 默认距离

    controlsRef.current.target.set(x, y, z);
    controlsRef.current.object.position.set(
      x,
      y + distance * 0.5,
      z + distance * 0.8
    );
    controlsRef.current.update();
  }, []);

  // 聚焦到指定星域
  const focusRegion = useCallback((regionId: number) => {
    if (!controlsRef.current) return;

    const regionSystems = systemsRef.current.filter(s => s.regionID === regionId);
    if (regionSystems.length === 0) return;

    // 计算星域的中心点
    let centerX = 0, centerY = 0, centerZ = 0;
    regionSystems.forEach(system => {
      centerX += system.position.x;
      centerY += system.position.y;
      centerZ += system.position.z;
    });
    centerX /= regionSystems.length;
    centerY /= regionSystems.length;
    centerZ /= regionSystems.length;

    // 计算边界框大小
    let maxDistance = 0;
    regionSystems.forEach(system => {
      const dx = system.position.x - centerX;
      const dy = system.position.y - centerY;
      const dz = system.position.z - centerZ;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    });

    const cameraDistance = maxDistance * 1.5;

    controlsRef.current.target.set(centerX, centerY, centerZ);
    controlsRef.current.object.position.set(
      centerX,
      centerY + cameraDistance * 0.5,
      centerZ + cameraDistance * 0.8
    );
    controlsRef.current.update();
  }, []);

  // 设置相机位置
  const setCameraPosition = useCallback((x: number, y: number, z: number) => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(x, y, z);
    controlsRef.current.update();
  }, []);

  // 设置相机目标
  const setCameraTarget = useCallback((x: number, y: number, z: number) => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(x, y, z);
    controlsRef.current.update();
  }, []);

  // 获取相机位置
  const getCameraPosition = useCallback(() => {
    if (!controlsRef.current) return null;
    const pos = controlsRef.current.object.position;
    return { x: pos.x, y: pos.y, z: pos.z };
  }, []);

  // 获取相机目标
  const getCameraTarget = useCallback(() => {
    if (!controlsRef.current) return null;
    const target = controlsRef.current.target;
    return { x: target.x, y: target.y, z: target.z };
  }, []);

  // 创建 mapControl 对象
  const mapControl: MapControl = {
    resetCamera,
    focusSystem,
    focusRegion,
    setCameraPosition,
    setCameraTarget,
    getCameraPosition,
    getCameraTarget,
    __internal: {
      setControlsRef,
      setSystems,
      setInitialCameraPosition,
    },
  };

  return mapControl;
}

