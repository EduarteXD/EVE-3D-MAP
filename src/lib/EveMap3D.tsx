import { useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import type { EveMap3DProps, SolarSystem } from './types';
import { Scene } from './components/eveMap3D/Scene';

// 主组件
export default function EveMap3D({
  systems,
  stargates,
  jumpgates = [],
  regions,
  language = 'zh',
  systemRenderConfigs,
  securityColors,
  focus,
  events,
  style,
  filterNewEdenOnly = true,
  highlightedRegionId: externalHighlightedRegionId,
  systemFilter,
  containerStyle,
  containerClassName,
  mapControl,
  jumpDriveConfig,
}: EveMap3DProps) {
  const [highlightedSystemIds, setHighlightedSystemIds] = useState<Set<number>>(new Set());
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [internalHighlightedRegionId, setInternalHighlightedRegionId] = useState<number | null>(null);

  // 使用外部传入的highlightedRegionId，如果没有则使用内部状态或focus
  const highlightedRegionId = useMemo(() => {
    if (externalHighlightedRegionId !== undefined) {
      return externalHighlightedRegionId;
    }
    if (internalHighlightedRegionId !== null) {
      return internalHighlightedRegionId;
    }
    if (focus?.type === 'region') {
      return focus.targetId;
    }
    return null;
  }, [externalHighlightedRegionId, internalHighlightedRegionId, focus]);

  // 当外部highlightedRegionId变化时（用户选择星域），清除选中的星系和高亮状态
  useEffect(() => {
    if (externalHighlightedRegionId !== undefined) {
      // 外部传入了highlightedRegionId（无论是null还是数字），清除选中的星系和高亮状态
      // 立即清除所有相关状态，避免被其他逻辑覆盖
      setHighlightedSystemIds(new Set());
      setSelectedSystemId(null);
      setInternalHighlightedRegionId(null);
    }
  }, [externalHighlightedRegionId]);

  // 根据focus更新高亮系统和选中状态
  useEffect(() => {
    if (focus) {
      if (focus.type === 'system') {
        setSelectedSystemId(focus.targetId);
        setHighlightedSystemIds(new Set([focus.targetId]));
        // 找到该星系所在的星域并高亮
        const system = systems.find(s => s._key === focus.targetId);
        if (system && externalHighlightedRegionId === undefined) {
          setInternalHighlightedRegionId(system.regionID);
        }
      } else if (focus.type === 'region') {
        // 聚焦到星域时清除选中状态
        setSelectedSystemId(null);
        setInternalHighlightedRegionId(null);
        const newSet = new Set<number>();
        setHighlightedSystemIds(newSet);
      }
    }
  }, [focus, systems, externalHighlightedRegionId]);

  // 当selectedSystemId变化时（用户点击），更新highlightedSystemIds并聚焦
  useEffect(() => {
    // 如果外部传入了highlightedRegionId，不允许通过点击星系来设置高亮
    if (externalHighlightedRegionId !== undefined) {
      return;
    }
    
    if (selectedSystemId !== null && (!focus || focus.type !== 'system')) {
      // 只有在没有focus或focus不是system时才更新highlightedSystemIds
      // 清除之前的高亮系统，只保留新选中的系统
      setHighlightedSystemIds(new Set([selectedSystemId]));
      
      // 自动聚焦到选中的星系
      if (mapControl?.focusSystem) {
        mapControl.focusSystem(selectedSystemId);
      }
      
      // 高亮该星系所在的星域
      const system = systems.find(s => s._key === selectedSystemId);
      if (system) {
        setInternalHighlightedRegionId(system.regionID);
      }
    }
  }, [selectedSystemId, focus, mapControl, systems, externalHighlightedRegionId]);

  const handleSystemClick = useCallback(
    (system: SolarSystem) => {
      // 更新选中状态
      setSelectedSystemId(system._key);
      
      // 调用外部回调
      if (events?.onSystemClick) {
        events.onSystemClick(system);
      }
    },
    [events]
  );

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', ...containerStyle }}
      className={containerClassName}
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
          highlightedRegionId={highlightedRegionId}
          highlightedSystemIds={highlightedSystemIds}
          selectedSystemId={selectedSystemId}
          systemRenderConfigs={systemRenderConfigs}
          securityColors={securityColors}
          language={language}
          style={style}
          focus={focus}
          onFocusComplete={events?.onFocusComplete}
          filterNewEdenOnly={filterNewEdenOnly}
          systemFilter={systemFilter}
          mapControl={mapControl}
          externalHighlightedRegionId={externalHighlightedRegionId}
          jumpDriveConfig={jumpDriveConfig}
        />
      </Canvas>
    </div>
  );
}

