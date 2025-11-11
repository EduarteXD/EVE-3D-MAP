import { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { Canvas } from '@react-three/fiber';
import type { EveMap3DProps, Region, SolarSystem } from './types';
import { Scene } from './components/Scene';
import { Compass2DOverlay } from './components/Compass2D';
import { ContextMenu, type ContextMenuItem } from './components/ContextMenu';

// 主组件
export default function EveMap3D({ 
  systems, 
  stargates, 
  jumpgates = [], 
  regions, 
  mapControl 
}: EveMap3DProps) {
  const [compassRotation, setCompassRotation] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // 订阅 mapControl 的状态变化
  const subscribe = useCallback((callback: () => void) => {
    if (mapControl.__internal?.subscribe) {
      return mapControl.__internal.subscribe(callback);
    }
    return () => {};
  }, [mapControl]);

  const getSnapshot = useCallback(() => {
    // 返回版本号而不是时间戳，只有在状态真正改变时才会触发重渲染
    return mapControl.__internal?.getVersion() ?? 0;
  }, [mapControl]);

  // 使用 useSyncExternalStore 订阅状态变化
  const version = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // 从 mapControl 获取配置和状态
  const config = mapControl.getConfig();
  const selectedSystemId = mapControl.getSelectedSystemId();
  const highlightedRegionId = mapControl.getHighlightedRegionId();
  const highlightedSystemIds = useMemo(
    () => new Set(mapControl.getHighlightedSystemIds()), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version] // 依赖版本号而不是 mapControl
  );

  const handleSystemClick = useCallback(
    (system: SolarSystem) => {
      // 通过 mapControl 选择星系，会自动处理聚焦和高亮
      mapControl.selectSystem(system._key);
    },
    [mapControl]
  );

  const handleRegionClick = useCallback(
    (region: Region) => {
      // 通过 mapControl 高亮星域，会自动处理聚焦
      mapControl.highlightRegion(region._key);
    },
    [mapControl]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const contextMenuItems: ContextMenuItem[] = useMemo(() => {
    const items: ContextMenuItem[] = [
      {
        label: config.language === 'zh' ? '重置视角' : 'Reset Camera',
        onClick: () => {
          mapControl.resetCamera();
          mapControl.highlightRegion(null);
        },
      },
    ];

    // 如果有选中的星系，添加相关选项
    if (selectedSystemId !== null) {
      const selectedSystem = systems.find(s => s._key === selectedSystemId);
      if (selectedSystem) {
        items.push({ label: '', onClick: () => {}, divider: true });
        items.push({
          label: config.language === 'zh' ? '取消选择' : 'Deselect',
          onClick: () => {
            mapControl.selectSystem(null);
          },
        });
        items.push({
          label: config.language === 'zh' ? '聚焦到星系' : 'Focus System',
          onClick: () => {
            mapControl.focusSystem(selectedSystemId);
          },
        });
      }
    }

    // 如果有高亮的星域，添加相关选项
    if (highlightedRegionId !== null) {
      const region = regions?.find(r => r._key === highlightedRegionId);
      if (region) {
        items.push({ label: '', onClick: () => {}, divider: true });
        items.push({
          label: config.language === 'zh' ? '聚焦到星域' : 'Focus Region',
          onClick: () => {
            mapControl.focusRegion(highlightedRegionId);
          },
        });
      }
    }

    return items;
  }, [config.language, systems, regions, mapControl, selectedSystemId, highlightedRegionId]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', ...config.containerStyle }}
      className={config.containerClassName}
      onContextMenu={handleContextMenu}
    >
      <Canvas
        camera={{
          position: [0, 0, 0],
          fov: 75,
          near: 1e14,
          far: 1e20,
        }}
        gl={{ antialias: true }}
      >
        <Scene
          systems={systems}
          stargates={stargates}
          jumpgates={jumpgates}
          regions={regions}
          onSystemClick={handleSystemClick}
          onRegionClick={handleRegionClick}
          highlightedRegionId={highlightedRegionId}
          highlightedSystemIds={highlightedSystemIds}
          selectedSystemId={selectedSystemId}
          systemRenderConfigs={config.systemRenderConfigs}
          securityColors={config.securityColors}
          language={config.language || 'zh'}
          style={config.style}
          filterNewEdenOnly={config.filterNewEdenOnly}
          systemFilter={config.systemFilter}
          mapControl={mapControl}
          jumpDriveConfig={config.jumpDriveConfig}
          onCompassRotationChange={setCompassRotation}
        />
      </Canvas>
      <Compass2DOverlay rotation={compassRotation} />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={handleCloseContextMenu}
        />
      )}
    </div>
  );
}
