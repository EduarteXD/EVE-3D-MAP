import { useRef, useCallback } from 'react';
import type { MapControl } from './types';
import type { SolarSystem } from './types';

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
// 缓动函数：easeInOutCubic
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function useMapControl(): MapControl {
  const controlsRef = useRef<OrbitControlsRef | null>(null);
  const systemsRef = useRef<SolarSystem[]>([]);
  const initialCameraPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const initialCameraTargetRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

    // 目标位置
    const targetCenter = {
      x: initialCameraTargetRef.current.x,
      y: initialCameraTargetRef.current.y,
      z: initialCameraTargetRef.current.z
    };
    const targetPosition = {
      x: initialCameraPositionRef.current.x,
      y: initialCameraPositionRef.current.y,
      z: initialCameraPositionRef.current.z
    };

    // 起始位置
    const startTarget = {
      x: controlsRef.current.target.x,
      y: controlsRef.current.target.y,
      z: controlsRef.current.target.z
    };
    const startPosition = {
      x: controlsRef.current.object.position.x,
      y: controlsRef.current.object.position.y,
      z: controlsRef.current.object.position.z
    };

    // 取消之前的动画
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 动画参数
    const duration = 1500; // 动画时长（毫秒）
    const startTime = performance.now();

    // 动画函数
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      // 插值计算当前位置
      const currentTarget = {
        x: startTarget.x + (targetCenter.x - startTarget.x) * eased,
        y: startTarget.y + (targetCenter.y - startTarget.y) * eased,
        z: startTarget.z + (targetCenter.z - startTarget.z) * eased
      };
      const currentPosition = {
        x: startPosition.x + (targetPosition.x - startPosition.x) * eased,
        y: startPosition.y + (targetPosition.y - startPosition.y) * eased,
        z: startPosition.z + (targetPosition.z - startPosition.z) * eased
      };

      // 更新相机位置和目标
      controlsRef.current!.target.set(currentTarget.x, currentTarget.y, currentTarget.z);
      controlsRef.current!.object.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
      controlsRef.current!.update();

      // 继续动画
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    // 开始动画
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // 聚焦到指定系统（聚焦到星系本身，但距离由所在星域计算）
  const focusSystem = useCallback((systemId: number) => {
    if (!controlsRef.current) return;

    const system = systemsRef.current.find(s => s._key === systemId);
    if (!system) return;

    // 找到该星系所在的星域的所有系统
    const regionSystems = systemsRef.current.filter(s => s.regionID === system.regionID);
    if (regionSystems.length === 0) return;

    // 计算星域的中心点（用于计算距离）
    let centerX = 0, centerY = 0, centerZ = 0;
    regionSystems.forEach(s => {
      centerX += -s.position.x;
      centerY += -s.position.y;
      centerZ += s.position.z;
    });
    centerX /= regionSystems.length;
    centerY /= regionSystems.length;
    centerZ /= regionSystems.length;

    // 计算边界框大小（用于确定相机距离）
    let maxDistance = 0;
    regionSystems.forEach(s => {
      const dx = -s.position.x - centerX;
      const dy = -s.position.y - centerY;
      const dz = s.position.z - centerZ;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    });

    const cameraDistance = Math.max(maxDistance * 1.5, 7e16);

    // 目标位置：聚焦到星系本身的位置
    const targetCenter = { x: -system.position.x, y: -system.position.y, z: system.position.z };
    const targetPosition = {
      x: -system.position.x,
      y: -system.position.y + cameraDistance * 0.5,
      z: system.position.z + cameraDistance * 0.8
    };

    // 起始位置
    const startTarget = {
      x: controlsRef.current.target.x,
      y: controlsRef.current.target.y,
      z: controlsRef.current.target.z
    };
    const startPosition = {
      x: controlsRef.current.object.position.x,
      y: controlsRef.current.object.position.y,
      z: controlsRef.current.object.position.z
    };

    // 取消之前的动画
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 动画参数
    const duration = 1500; // 动画时长（毫秒）
    const startTime = performance.now();

    // 动画函数
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      // 插值计算当前位置
      const currentTarget = {
        x: startTarget.x + (targetCenter.x - startTarget.x) * eased,
        y: startTarget.y + (targetCenter.y - startTarget.y) * eased,
        z: startTarget.z + (targetCenter.z - startTarget.z) * eased
      };
      const currentPosition = {
        x: startPosition.x + (targetPosition.x - startPosition.x) * eased,
        y: startPosition.y + (targetPosition.y - startPosition.y) * eased,
        z: startPosition.z + (targetPosition.z - startPosition.z) * eased
      };

      // 更新相机位置和目标
      controlsRef.current!.target.set(currentTarget.x, currentTarget.y, currentTarget.z);
      controlsRef.current!.object.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
      controlsRef.current!.update();

      // 继续动画
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    // 开始动画
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // 聚焦到指定星域
  const focusRegion = useCallback((regionId: number) => {
    if (!controlsRef.current) return;

    const regionSystems = systemsRef.current.filter(s => s.regionID === regionId);
    if (regionSystems.length === 0) return;

    // 计算星域的中心点
    let centerX = 0, centerY = 0, centerZ = 0;
    regionSystems.forEach(system => {
      centerX += -system.position.x;
      centerY += -system.position.y;
      centerZ += system.position.z;
    });
    centerX /= regionSystems.length;
    centerY /= regionSystems.length;
    centerZ /= regionSystems.length;

    // 计算边界框大小
    let maxDistance = 0;
    regionSystems.forEach(system => {
      const dx = -system.position.x - centerX;
      const dy = -system.position.y - centerY;
      const dz = system.position.z - centerZ;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    });

    const cameraDistance = Math.max(maxDistance * 1.5, 7e16);

    // 目标位置
    const targetCenter = { x: centerX, y: centerY, z: centerZ };
    const targetPosition = {
      x: centerX,
      y: centerY + cameraDistance * 0.5,
      z: centerZ + cameraDistance * 0.8
    };

    // 起始位置
    const startTarget = {
      x: controlsRef.current.target.x,
      y: controlsRef.current.target.y,
      z: controlsRef.current.target.z
    };
    const startPosition = {
      x: controlsRef.current.object.position.x,
      y: controlsRef.current.object.position.y,
      z: controlsRef.current.object.position.z
    };

    // 取消之前的动画
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 动画参数
    const duration = 1500; // 动画时长（毫秒）
    const startTime = performance.now();

    // 动画函数
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      // 插值计算当前位置
      const currentTarget = {
        x: startTarget.x + (targetCenter.x - startTarget.x) * eased,
        y: startTarget.y + (targetCenter.y - startTarget.y) * eased,
        z: startTarget.z + (targetCenter.z - startTarget.z) * eased
      };
      const currentPosition = {
        x: startPosition.x + (targetPosition.x - startPosition.x) * eased,
        y: startPosition.y + (targetPosition.y - startPosition.y) * eased,
        z: startPosition.z + (targetPosition.z - startPosition.z) * eased
      };

      // 更新相机位置和目标
      controlsRef.current!.target.set(currentTarget.x, currentTarget.y, currentTarget.z);
      controlsRef.current!.object.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
      controlsRef.current!.update();

      // 继续动画
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    // 开始动画
    animationFrameRef.current = requestAnimationFrame(animate);
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

