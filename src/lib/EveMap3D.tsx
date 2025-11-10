import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import type {
  EveMap3DProps,
  SolarSystem,
  Stargate,
  SystemRenderConfig,
  SecurityColorConfig,
  FocusConfig,
  Language,
  MapControl,
} from './types';
import { isNewEdenSystem } from './utils';

// 默认颜色配置
const DEFAULT_SECURITY_COLORS: Required<SecurityColorConfig> = {
  highsec: '#4CAF50',
  lowsec: '#FF9800',
  nullsec: '#F44336',
};

const DEFAULT_HIGHLIGHT_COLORS: Required<SecurityColorConfig> = {
  highsec: '#66FF66',
  lowsec: '#FFB84D',
  nullsec: '#FF6666',
};

// 批量渲染太阳系点的组件 - 使用InstancedMesh
function SolarSystemPoints({
  systems,
  onSystemClick,
  highlightedRegionId,
  highlightedSystemIds,
  systemRenderConfigs,
  securityColors,
}: {
  systems: SolarSystem[];
  onSystemClick: (system: SolarSystem) => void;
  highlightedRegionId: number | null;
  highlightedSystemIds: Set<number>;
  systemRenderConfigs?: SystemRenderConfig[];
  securityColors?: SecurityColorConfig;
}) {
  const highsecNormalRef = useRef<THREE.InstancedMesh>(null);
  const highsecHighlightRef = useRef<THREE.InstancedMesh>(null);
  const lowsecNormalRef = useRef<THREE.InstancedMesh>(null);
  const lowsecHighlightRef = useRef<THREE.InstancedMesh>(null);
  const nullsecNormalRef = useRef<THREE.InstancedMesh>(null);
  const nullsecHighlightRef = useRef<THREE.InstancedMesh>(null);
  const customSystemsRefs = useRef<Map<string, THREE.InstancedMesh>>(new Map());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const { camera, gl } = useThree();
  const pointSize = 1e15;

  // 合并颜色配置
  const mergedSecurityColors = useMemo(() => ({
    highsec: securityColors?.highsec || DEFAULT_SECURITY_COLORS.highsec,
    lowsec: securityColors?.lowsec || DEFAULT_SECURITY_COLORS.lowsec,
    nullsec: securityColors?.nullsec || DEFAULT_SECURITY_COLORS.nullsec,
  }), [securityColors]);

  const mergedHighlightColors = useMemo(() => ({
    highsec: DEFAULT_HIGHLIGHT_COLORS.highsec,
    lowsec: DEFAULT_HIGHLIGHT_COLORS.lowsec,
    nullsec: DEFAULT_HIGHLIGHT_COLORS.nullsec,
  }), []);

  // 创建几何体和材质
  const normalGeometry = useMemo(() => new THREE.SphereGeometry(pointSize, 16, 16), []);
  const highlightGeometry = useMemo(() => new THREE.SphereGeometry(pointSize * 1.5, 16, 16), []);

  // 创建材质
  const materials = useMemo(() => {
    const baseMaterials = {
      highsec: new THREE.MeshBasicMaterial({
        color: mergedSecurityColors.highsec,
        transparent: true,
        opacity: 0.9,
      }),
      lowsec: new THREE.MeshBasicMaterial({
        color: mergedSecurityColors.lowsec,
        transparent: true,
        opacity: 0.9,
      }),
      nullsec: new THREE.MeshBasicMaterial({
        color: mergedSecurityColors.nullsec,
        transparent: true,
        opacity: 0.9,
      }),
    };

    const highlightMaterials = {
      highsec: new THREE.MeshBasicMaterial({
        color: mergedHighlightColors.highsec,
        transparent: true,
        opacity: 1.0,
      }),
      lowsec: new THREE.MeshBasicMaterial({
        color: mergedHighlightColors.lowsec,
        transparent: true,
        opacity: 1.0,
      }),
      nullsec: new THREE.MeshBasicMaterial({
        color: mergedHighlightColors.nullsec,
        transparent: true,
        opacity: 1.0,
      }),
    };

    return { baseMaterials, highlightMaterials };
  }, [mergedSecurityColors, mergedHighlightColors]);

  // 创建自定义系统配置映射
  const systemConfigMap = useMemo(() => {
    if (!systemRenderConfigs) return new Map<number, SystemRenderConfig>();
    return new Map(systemRenderConfigs.map(config => [config.systemId, config]));
  }, [systemRenderConfigs]);

  // 按安全等级和自定义配置分组系统
  const systemGroups = useMemo(() => {
    const groups = {
      highsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
      lowsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
      nullsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
      custom: [] as Array<{ system: SolarSystem; config: SystemRenderConfig }>,
    };

    systems.forEach(system => {
      const customConfig = systemConfigMap.get(system._key);
      
      // 如果有自定义配置，使用自定义渲染
      if (customConfig) {
        groups.custom.push({ system, config: customConfig });
        return;
      }

      // 否则按安全等级分组
      const isHighlighted =
        (highlightedRegionId !== null && system.regionID === highlightedRegionId) ||
        highlightedSystemIds.has(system._key);
      const category =
        system.securityStatus >= 0.45
          ? 'highsec'
          : system.securityStatus >= 0.0
            ? 'lowsec'
            : 'nullsec';

      if (isHighlighted) {
        groups[category].highlighted.push(system);
      } else {
        groups[category].normal.push(system);
      }
    });

    return groups;
  }, [systems, highlightedRegionId, highlightedSystemIds, systemConfigMap]);

  // 自定义系统按配置分组（相同颜色、大小、高亮状态的系统分组）
  const customSystemGroups = useMemo(() => {
    const groups = new Map<string, Array<{ system: SolarSystem; config: SystemRenderConfig }>>();
    systemGroups.custom.forEach(({ system, config }) => {
      const color = config.color || mergedSecurityColors.highsec;
      const size = config.size || 1.0;
      const highlighted = config.highlighted || false;
      const opacity = config.opacity !== undefined ? config.opacity : 0.9;
      const key = `${color}-${size}-${highlighted}-${opacity}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push({ system, config });
    });
    return groups;
  }, [systemGroups.custom, mergedSecurityColors]);

  // 自定义系统的材质和几何体
  const customMaterialsAndGeometries = useMemo(() => {
    const result = new Map<string, { material: THREE.MeshBasicMaterial; geometry: THREE.SphereGeometry }>();
    customSystemGroups.forEach((items, key) => {
      if (!result.has(key)) {
        const config = items[0].config;
        const color = config.color || mergedSecurityColors.highsec;
        const opacity = config.opacity !== undefined ? config.opacity : 0.9;
        const size = config.size || 1.0;
        const highlighted = config.highlighted || false;
        const scale = highlighted ? 1.5 * size : size;
        
        result.set(key, {
          material: new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
          }),
          geometry: new THREE.SphereGeometry(pointSize * scale, 16, 16),
        });
      }
    });
    return result;
  }, [customSystemGroups, mergedSecurityColors, pointSize]);

  // 更新实例矩阵
  useEffect(() => {
    const matrix = new THREE.Matrix4();

    // 高安系统 - 普通
    if (highsecNormalRef.current) {
      systemGroups.highsec.normal.forEach((system, index) => {
        matrix.setPosition(system.position.x, system.position.y, system.position.z);
        highsecNormalRef.current!.setMatrixAt(index, matrix);
      });
      highsecNormalRef.current.instanceMatrix.needsUpdate = true;
    }

    // 高安系统 - 高亮
    if (highsecHighlightRef.current) {
      systemGroups.highsec.highlighted.forEach((system, index) => {
        matrix.setPosition(system.position.x, system.position.y, system.position.z);
        highsecHighlightRef.current!.setMatrixAt(index, matrix);
      });
      highsecHighlightRef.current.instanceMatrix.needsUpdate = true;
    }

    // 低安系统 - 普通
    if (lowsecNormalRef.current) {
      systemGroups.lowsec.normal.forEach((system, index) => {
        matrix.setPosition(system.position.x, system.position.y, system.position.z);
        lowsecNormalRef.current!.setMatrixAt(index, matrix);
      });
      lowsecNormalRef.current.instanceMatrix.needsUpdate = true;
    }

    // 低安系统 - 高亮
    if (lowsecHighlightRef.current) {
      systemGroups.lowsec.highlighted.forEach((system, index) => {
        matrix.setPosition(system.position.x, system.position.y, system.position.z);
        lowsecHighlightRef.current!.setMatrixAt(index, matrix);
      });
      lowsecHighlightRef.current.instanceMatrix.needsUpdate = true;
    }

    // 00系统 - 普通
    if (nullsecNormalRef.current) {
      systemGroups.nullsec.normal.forEach((system, index) => {
        matrix.setPosition(system.position.x, system.position.y, system.position.z);
        nullsecNormalRef.current!.setMatrixAt(index, matrix);
      });
      nullsecNormalRef.current.instanceMatrix.needsUpdate = true;
    }

    // 00系统 - 高亮
    if (nullsecHighlightRef.current) {
      systemGroups.nullsec.highlighted.forEach((system, index) => {
        matrix.setPosition(system.position.x, system.position.y, system.position.z);
        nullsecHighlightRef.current!.setMatrixAt(index, matrix);
      });
      nullsecHighlightRef.current.instanceMatrix.needsUpdate = true;
    }

    // 自定义系统
    customSystemGroups.forEach((items, key) => {
      const ref = customSystemsRefs.current.get(key);
      if (ref) {
        items.forEach(({ system }, index) => {
          matrix.setPosition(system.position.x, system.position.y, system.position.z);
          ref.setMatrixAt(index, matrix);
        });
        ref.instanceMatrix.needsUpdate = true;
      }
    });
  }, [systemGroups, customSystemGroups]);

  // 处理点击事件
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const meshes = [
        { ref: highsecNormalRef, systems: systemGroups.highsec.normal },
        { ref: highsecHighlightRef, systems: systemGroups.highsec.highlighted },
        { ref: lowsecNormalRef, systems: systemGroups.lowsec.normal },
        { ref: lowsecHighlightRef, systems: systemGroups.lowsec.highlighted },
        { ref: nullsecNormalRef, systems: systemGroups.nullsec.normal },
        { ref: nullsecHighlightRef, systems: systemGroups.nullsec.highlighted },
      ];

      // 添加自定义系统的mesh
      customSystemGroups.forEach((items, key) => {
        const ref = customSystemsRefs.current.get(key);
        if (ref) {
          meshes.push({
            ref: { current: ref },
            systems: items.map(item => item.system),
          });
        }
      });

      for (const { ref, systems: groupSystems } of meshes) {
        if (ref.current) {
          const intersects = raycaster.intersectObject(ref.current);
          if (intersects.length > 0) {
            const instanceId = intersects[0].instanceId!;
            if (instanceId < groupSystems.length) {
              onSystemClick(groupSystems[instanceId]);
              return;
            }
          }
        }
      }
    };

    gl.domElement.addEventListener('click', handleClick);

    return () => {
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [gl, camera, raycaster, mouse, systemGroups, customSystemGroups, onSystemClick]);

  return (
    <>
      {/* 高安系统 - 普通 */}
      {systemGroups.highsec.normal.length > 0 && (
        <instancedMesh
          ref={highsecNormalRef}
          args={[normalGeometry, materials.baseMaterials.highsec, systemGroups.highsec.normal.length]}
        />
      )}
      {/* 高安系统 - 高亮 */}
      {systemGroups.highsec.highlighted.length > 0 && (
        <instancedMesh
          ref={highsecHighlightRef}
          args={[highlightGeometry, materials.highlightMaterials.highsec, systemGroups.highsec.highlighted.length]}
        />
      )}
      {/* 低安系统 - 普通 */}
      {systemGroups.lowsec.normal.length > 0 && (
        <instancedMesh
          ref={lowsecNormalRef}
          args={[normalGeometry, materials.baseMaterials.lowsec, systemGroups.lowsec.normal.length]}
        />
      )}
      {/* 低安系统 - 高亮 */}
      {systemGroups.lowsec.highlighted.length > 0 && (
        <instancedMesh
          ref={lowsecHighlightRef}
          args={[highlightGeometry, materials.highlightMaterials.lowsec, systemGroups.lowsec.highlighted.length]}
        />
      )}
      {/* 00系统 - 普通 */}
      {systemGroups.nullsec.normal.length > 0 && (
        <instancedMesh
          ref={nullsecNormalRef}
          args={[normalGeometry, materials.baseMaterials.nullsec, systemGroups.nullsec.normal.length]}
        />
      )}
      {/* 00系统 - 高亮 */}
      {systemGroups.nullsec.highlighted.length > 0 && (
        <instancedMesh
          ref={nullsecHighlightRef}
          args={[highlightGeometry, materials.highlightMaterials.nullsec, systemGroups.nullsec.highlighted.length]}
        />
      )}
      {/* 自定义系统 */}
      {Array.from(customSystemGroups.entries()).map(([key, items]) => {
        const { material, geometry } = customMaterialsAndGeometries.get(key)!;
        return (
          <instancedMesh
            key={key}
            ref={(ref) => {
              if (ref) {
                customSystemsRefs.current.set(key, ref);
              } else {
                customSystemsRefs.current.delete(key);
              }
            }}
            args={[geometry, material, items.length]}
          />
        );
      })}
    </>
  );
}

// 合并的星门连接线组件
function StargateConnections({
  connections,
  highlightedRegionId,
  highlightedSystemIds,
  style,
}: {
  connections: Array<{ from: SolarSystem; to: SolarSystem }>;
  highlightedRegionId: number | null;
  highlightedSystemIds: Set<number>;
  style?: { connectionLineColor?: string; connectionLineOpacity?: number; highlightedConnectionLineColor?: string };
}) {
  const { normalConnections, highlightedConnections } = useMemo(() => {
    const normal: Array<{ from: SolarSystem; to: SolarSystem }> = [];
    const highlighted: Array<{ from: SolarSystem; to: SolarSystem }> = [];

    connections.forEach(conn => {
      const isHighlighted =
        (highlightedRegionId !== null &&
          conn.from.regionID === highlightedRegionId &&
          conn.to.regionID === highlightedRegionId) ||
        highlightedSystemIds.has(conn.from._key) ||
        highlightedSystemIds.has(conn.to._key);

      if (isHighlighted) {
        highlighted.push(conn);
      } else {
        normal.push(conn);
      }
    });

    return { normalConnections: normal, highlightedConnections: highlighted };
  }, [connections, highlightedRegionId, highlightedSystemIds]);

  const normalLineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    normalConnections.forEach(conn => {
      positions.push(
        conn.from.position.x,
        conn.from.position.y,
        conn.from.position.z,
        conn.to.position.x,
        conn.to.position.y,
        conn.to.position.z
      );
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [normalConnections]);

  const highlightedLineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    highlightedConnections.forEach(conn => {
      positions.push(
        conn.from.position.x,
        conn.from.position.y,
        conn.from.position.z,
        conn.to.position.x,
        conn.to.position.y,
        conn.to.position.z
      );
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [highlightedConnections]);

  const normalMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: style?.connectionLineColor || '#4488ff',
        transparent: true,
        opacity: style?.connectionLineOpacity !== undefined ? style.connectionLineOpacity : 0.3,
      }),
    [style]
  );

  const highlightedMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: style?.highlightedConnectionLineColor || '#00ffff',
        transparent: false,
        opacity: 1.0,
      }),
    [style]
  );

  return (
    <>
      {normalConnections.length > 0 && (
        <lineSegments geometry={normalLineGeometry} material={normalMaterial} />
      )}
      {highlightedConnections.length > 0 && (
        <lineSegments geometry={highlightedLineGeometry} material={highlightedMaterial} />
      )}
    </>
  );
}

// 选中系统的白圈指示器
function SelectionRing({ system }: { system: SolarSystem }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const pointSize = 1e15;
  const ringRadius = pointSize * 2.5;
  const ringThickness = 2e14;

  useFrame(() => {
    if (ringRef.current) {
      ringRef.current.lookAt(camera.position);
    }
  });

  return (
    <mesh ref={ringRef} position={[system.position.x, system.position.y, system.position.z]}>
      <ringGeometry args={[ringRadius, ringRadius + ringThickness, 64]} />
      <meshBasicMaterial color="white" side={THREE.DoubleSide} transparent opacity={0.9} />
    </mesh>
  );
}

// 太阳系标签组件
function SolarSystemLabel({
  system,
  language,
  style,
}: {
  system: SolarSystem;
  language: Language;
  style?: { labelFontSize?: number; labelColor?: string };
}) {
  const textRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const pointSize = 1e15;
  const baseFontSize = style?.labelFontSize || 2e15;
  const labelOffset = pointSize * 3;

  useFrame(() => {
    if (textRef.current) {
      textRef.current.lookAt(camera.position);
      const distance = camera.position.distanceTo(textRef.current.position);
      const scale = distance / 4e16;
      textRef.current.scale.setScalar(scale);
    }
  });

  const systemName = language === 'zh' ? system.name.zh || system.name.en : system.name.en || system.name.zh;

  return (
    <Text
      ref={textRef}
      position={[system.position.x, system.position.y + labelOffset + 5e15, system.position.z]}
      fontSize={baseFontSize}
      color={style?.labelColor || 'white'}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.05}
      outlineColor="#000"
    >
      {systemName || String(system._key)}
    </Text>
  );
}

// 主场景组件
function Scene({
  systems,
  stargates,
  onSystemClick,
  highlightedRegionId,
  highlightedSystemIds,
  selectedSystemId,
  systemRenderConfigs,
  securityColors,
  language,
  style,
  focus,
  onFocusComplete,
  filterNewEdenOnly,
  systemFilter,
  mapControl,
}: {
  systems: SolarSystem[];
  stargates: Stargate[];
  onSystemClick: (system: SolarSystem) => void;
  highlightedRegionId: number | null;
  highlightedSystemIds: Set<number>;
  selectedSystemId: number | null;
  systemRenderConfigs?: SystemRenderConfig[];
  securityColors?: SecurityColorConfig;
  language: Language;
  style?: { connectionLineColor?: string; connectionLineOpacity?: number; highlightedConnectionLineColor?: string; labelFontSize?: number; labelColor?: string; backgroundColor?: string };
  focus?: FocusConfig;
  onFocusComplete?: (config: FocusConfig) => void;
  filterNewEdenOnly?: boolean;
  systemFilter?: (system: SolarSystem) => boolean;
  mapControl?: MapControl;
}) {
  const [filteredSystems, setFilteredSystems] = useState<SolarSystem[]>([]);
  const [connections, setConnections] = useState<Array<{ from: SolarSystem; to: SolarSystem }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const cameraInitializedRef = useRef(false);
  const lastHighlightedRegionIdRef = useRef<number | null>(null);
  const { scene, camera } = useThree();

  // 将 controlsRef 暴露给 mapControl
  useEffect(() => {
    if (mapControl?.__internal?.setControlsRef) {
      mapControl.__internal.setControlsRef(controlsRef.current);
    }
  }, [mapControl]);

  // 将系统数据暴露给 mapControl
  useEffect(() => {
    if (mapControl?.__internal?.setSystems) {
      mapControl.__internal.setSystems(filteredSystems);
    }
  }, [mapControl, filteredSystems]);

  useEffect(() => {
    const bgColor = style?.backgroundColor || '#000000';
    const colorValue = bgColor.startsWith('#') 
      ? parseInt(bgColor.replace('#', ''), 16) 
      : parseInt(bgColor, 16);
    scene.background = new THREE.Color(colorValue);
  }, [scene, style]);

  const systemMap = useMemo(() => {
    const map = new Map<number, SolarSystem>();
    systems.forEach(system => {
      map.set(system._key, system);
    });
    return map;
  }, [systems]);

  useEffect(() => {
    let filtered = filterNewEdenOnly !== false ? systems.filter(s => isNewEdenSystem(s._key)) : systems;
    if (systemFilter) {
      filtered = filtered.filter(systemFilter);
    }
    setFilteredSystems(filtered);
  }, [systems, filterNewEdenOnly, systemFilter]);

  useEffect(() => {
    if (filteredSystems.length === 0 || stargates.length === 0) return;

    const newConnections: Array<{ from: SolarSystem; to: SolarSystem }> = [];
    const systemSet = new Set(filteredSystems.map(s => s._key));
    const connectionSet = new Set<string>();

    stargates.forEach(stargate => {
      const fromSystem = systemMap.get(stargate.solarSystemID);
      const toSystem = systemMap.get(stargate.destination.solarSystemID);

      if (
        fromSystem &&
        toSystem &&
        systemSet.has(fromSystem._key) &&
        systemSet.has(toSystem._key)
      ) {
        const minId = Math.min(fromSystem._key, toSystem._key);
        const maxId = Math.max(fromSystem._key, toSystem._key);
        const connectionKey = `${minId}-${maxId}`;

        if (!connectionSet.has(connectionKey)) {
          connectionSet.add(connectionKey);
          newConnections.push({ from: fromSystem, to: toSystem });
        }
      }
    });

    setConnections(newConnections);
  }, [filteredSystems, stargates, systemMap]);

  // 初始相机定位（只在首次加载时执行一次）
  useEffect(() => {
    if (filteredSystems.length === 0 || !controlsRef.current) return;
    if (cameraInitializedRef.current) return; // 已经初始化过，不再重置
    if (highlightedRegionId !== null || focus) return;

    const box = new THREE.Box3();
    filteredSystems.forEach(system => {
      const pos = new THREE.Vector3(system.position.x, system.position.y, system.position.z);
      box.expandByPoint(pos);
    });

    const center = new THREE.Vector3();
    box.getCenter(center);
    const boxSize = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z);

    const cameraDistance = maxSize * 1.5;
    const initialPosition = new THREE.Vector3(
      center.x,
      center.y + cameraDistance * 0.5,
      center.z + cameraDistance * 0.8
    );
    controlsRef.current.target.copy(center);
    controlsRef.current.object.position.copy(initialPosition);
    controlsRef.current.update();
    cameraInitializedRef.current = true; // 标记为已初始化

    // 将初始相机位置保存到 mapControl
    if (mapControl?.__internal?.setInitialCameraPosition) {
      mapControl.__internal.setInitialCameraPosition(
        { x: initialPosition.x, y: initialPosition.y, z: initialPosition.z },
        { x: center.x, y: center.y, z: center.z }
      );
    }
  }, [filteredSystems, highlightedRegionId, focus, mapControl]);

  // 高亮星域时移动相机（只在用户主动选择星域时执行）
  useEffect(() => {
    if (highlightedRegionId === null || !controlsRef.current || filteredSystems.length === 0) {
      lastHighlightedRegionIdRef.current = highlightedRegionId;
      return;
    }

    // 如果highlightedRegionId没有变化，不执行相机移动
    if (lastHighlightedRegionIdRef.current === highlightedRegionId) return;
    lastHighlightedRegionIdRef.current = highlightedRegionId;

    const regionSystems = filteredSystems.filter(system => system.regionID === highlightedRegionId);
    if (regionSystems.length === 0) return;

    const box = new THREE.Box3();
    regionSystems.forEach(system => {
      const pos = new THREE.Vector3(system.position.x, system.position.y, system.position.z);
      box.expandByPoint(pos);
    });

    const targetCenter = new THREE.Vector3();
    box.getCenter(targetCenter);
    const boxSize = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z);

    const cameraDistance = maxSize * 1.5;
    const targetPosition = new THREE.Vector3(
      targetCenter.x,
      targetCenter.y + cameraDistance * 0.5,
      targetCenter.z + cameraDistance * 0.8
    );

    const startTarget = controlsRef.current.target.clone();
    const startPosition = camera.position.clone();
    const duration = 1500;
    const startTime = Date.now();
    let animationFrameId: number;

    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      const currentTarget = startTarget.clone().lerp(targetCenter, easedProgress);
      const currentPosition = startPosition.clone().lerp(targetPosition, easedProgress);

      controlsRef.current.target.copy(currentTarget);
      camera.position.copy(currentPosition);
      controlsRef.current.update();

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [highlightedRegionId, filteredSystems, camera]);

  // 聚焦功能
  useEffect(() => {
    if (!focus || !controlsRef.current || filteredSystems.length === 0) return;

    let targetSystems: SolarSystem[] = [];
    if (focus.type === 'system') {
      const system = filteredSystems.find(s => s._key === focus.targetId);
      if (system) targetSystems = [system];
    } else if (focus.type === 'region') {
      targetSystems = filteredSystems.filter(s => s.regionID === focus.targetId);
    }

    if (targetSystems.length === 0) return;

    const box = new THREE.Box3();
    targetSystems.forEach(system => {
      const pos = new THREE.Vector3(system.position.x, system.position.y, system.position.z);
      box.expandByPoint(pos);
    });

    const targetCenter = new THREE.Vector3();
    box.getCenter(targetCenter);
    const boxSize = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z);

    const cameraDistance = maxSize * 1.5;
    const targetPosition = new THREE.Vector3(
      targetCenter.x,
      targetCenter.y + cameraDistance * 0.5,
      targetCenter.z + cameraDistance * 0.8
    );

    const startTarget = controlsRef.current.target.clone();
    const startPosition = camera.position.clone();
    const duration = focus.animationDuration || 1500;
    const startTime = Date.now();
    let animationFrameId: number;

    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      const currentTarget = startTarget.clone().lerp(targetCenter, easedProgress);
      const currentPosition = startPosition.clone().lerp(targetPosition, easedProgress);

      controlsRef.current.target.copy(currentTarget);
      camera.position.copy(currentPosition);
      controlsRef.current.update();

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else if (onFocusComplete) {
        onFocusComplete(focus);
      }
    };

    animate();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [focus, filteredSystems, camera, onFocusComplete]);

  return (
    <>
      <Stars radius={1e18} depth={50} count={5000} factor={4} fade speed={1} />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={1} />

      {connections.length > 0 && (
        <StargateConnections
          connections={connections}
          highlightedRegionId={highlightedRegionId}
          highlightedSystemIds={highlightedSystemIds}
          style={style}
        />
      )}

      {filteredSystems.length > 0 && (
        <SolarSystemPoints
          systems={filteredSystems}
          onSystemClick={onSystemClick}
          highlightedRegionId={highlightedRegionId}
          highlightedSystemIds={highlightedSystemIds}
          systemRenderConfigs={systemRenderConfigs}
          securityColors={securityColors}
        />
      )}

      {/* 显示选中系统的白圈指示器和标签 */}
      {selectedSystemId !== null && (() => {
        const selectedSystem = filteredSystems.find(s => s._key === selectedSystemId);
        if (!selectedSystem) return null;
        return (
          <>
            <SelectionRing system={selectedSystem} />
            <SolarSystemLabel system={selectedSystem} language={language} style={style} />
          </>
        );
      })()}

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1e15}
        maxDistance={1e19}
        autoRotate={false}
      />
    </>
  );
}

// 主组件
export default function EveMap3D({
  systems,
  stargates,
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
}: EveMap3DProps) {
  const [highlightedSystemIds, setHighlightedSystemIds] = useState<Set<number>>(new Set());
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);

  // 使用外部传入的highlightedRegionId，如果没有则使用focus
  const highlightedRegionId = useMemo(() => {
    if (externalHighlightedRegionId !== undefined) {
      return externalHighlightedRegionId;
    }
    if (focus?.type === 'region') {
      return focus.targetId;
    }
    return null;
  }, [externalHighlightedRegionId, focus]);

  // 根据focus更新高亮系统和选中状态
  useEffect(() => {
    if (focus) {
      if (focus.type === 'system') {
        setSelectedSystemId(focus.targetId);
        setHighlightedSystemIds(new Set([focus.targetId]));
      } else if (focus.type === 'region') {
        // 聚焦到星域时不清除选中状态，但清除高亮系统（除了选中的）
        const newSet = new Set<number>();
        // 保留选中的系统
        if (selectedSystemId !== null) {
          newSet.add(selectedSystemId);
        }
        setHighlightedSystemIds(newSet);
      }
    }
  }, [focus, selectedSystemId]);

  // 当selectedSystemId变化时（用户点击），更新highlightedSystemIds
  useEffect(() => {
    if (selectedSystemId !== null && (!focus || focus.type !== 'system')) {
      // 只有在没有focus或focus不是system时才更新highlightedSystemIds
      // 清除之前的高亮系统，只保留新选中的系统
      setHighlightedSystemIds(new Set([selectedSystemId]));
    }
  }, [selectedSystemId, focus]);

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
        />
      </Canvas>
    </div>
  );
}

