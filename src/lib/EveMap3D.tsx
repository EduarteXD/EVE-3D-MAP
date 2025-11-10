import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import type {
  EveMap3DProps,
  SolarSystem,
  Stargate,
  Region,
  SystemRenderConfig,
  SecurityColorConfig,
  FocusConfig,
  Language,
  MapControl,
  Jumpgate,
  JumpDriveConfig,
} from './types';
import { isNewEdenSystem } from './utils';

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

const JUMP_DRIVE_LIGHTYEAR_IN_METERS = 9_460_000_000_000_000;
const SYSTEM_POINT_SIZE = 8e14;

function clampSystemPointBaseScale(size?: number) {
  if (!Number.isFinite(size)) {
    return 1;
  }
  if (size === undefined) {
    return 1;
  }
  if (size < 0) {
    return 0;
  }
  return size;
}

// 批量渲染太阳系点的组件 - 使用InstancedMesh
function SolarSystemPoints({
  systems,
  onSystemClick,
  highlightedRegionId,
  highlightedSystemIds,
  systemRenderConfigs,
  securityColors,
  jumpDriveHighlight,
  jumpDriveConfig,
}: {
  systems: SolarSystem[];
  onSystemClick: (system: SolarSystem) => void;
  highlightedRegionId: number | null;
  highlightedSystemIds: Set<number>;
  systemRenderConfigs?: SystemRenderConfig[];
  securityColors?: SecurityColorConfig;
  jumpDriveHighlight?: {
    systems: SolarSystem[];
    color: string;
    scale: number;
    opacity: number;
  };
  jumpDriveConfig?: JumpDriveConfig;
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
  const normalGeometry = useMemo(() => new THREE.SphereGeometry(SYSTEM_POINT_SIZE, 16, 16), []);
  const highlightGeometry = useMemo(() => new THREE.SphereGeometry(SYSTEM_POINT_SIZE * 1.5, 16, 16), []);
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
      const size = clampSystemPointBaseScale(config.size ?? 1.0);
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
      const scale = clampSystemPointBaseScale(config.size ?? 1.0);
        
        result.set(key, {
          material: new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
          }),
          geometry: new THREE.SphereGeometry(SYSTEM_POINT_SIZE * scale, 16, 16),
        });
      }
    });
    return result;
  }, [customSystemGroups, mergedSecurityColors]);

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
      {jumpDriveHighlight && jumpDriveHighlight.systems.length > 0 &&
        jumpDriveHighlight.systems.filter(system => system._key !== jumpDriveConfig?.originSystemId).map(system => (
          <JumpDriveReachableRing
            key={`jumpdrive-ring-${system._key}`}
            system={system}
            color={jumpDriveHighlight.color}
            opacity={jumpDriveHighlight.opacity}
            scale={jumpDriveHighlight.scale}
          />
        ))}
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

// 玩家跳桥连接线组件
function JumpgateConnections({
  connections,
  highlightedRegionId,
  highlightedSystemIds,
  style,
}: {
  connections: Array<{ from: SolarSystem; to: SolarSystem }>;
  highlightedRegionId: number | null;
  highlightedSystemIds: Set<number>;
  style?: { jumpgateLineColor?: string; jumpgateLineOpacity?: number; highlightedJumpgateLineColor?: string; jumpgateCurveHeightScale?: number };
}) {
  const curveSegments = 48;

  const materialSettings = useMemo(
    () => ({
      normalColor: style?.jumpgateLineColor || '#00ff00',
      normalOpacity: style?.jumpgateLineOpacity !== undefined ? style.jumpgateLineOpacity : 0.85,
      highlightedColor: style?.highlightedJumpgateLineColor || '#00ff00',
      curveHeightScale: style?.jumpgateCurveHeightScale ?? 0.2,
    }),
    [style]
  );

  const normalMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: materialSettings.normalColor,
        transparent: materialSettings.normalOpacity < 1,
        opacity: materialSettings.normalOpacity,
      }),
    [materialSettings]
  );

  const highlightedMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: materialSettings.highlightedColor,
        transparent: false,
        opacity: 1.0,
      }),
    [materialSettings]
  );

  const { curveHeightScale } = materialSettings;

  const curves = useMemo(() => {
    const results: Array<{
      key: string;
      geometry: THREE.BufferGeometry;
      highlighted: boolean;
    }> = [];

    connections.forEach(conn => {
      const fromPosition = new THREE.Vector3(conn.from.position.x, conn.from.position.y, conn.from.position.z);
      const toPosition = new THREE.Vector3(conn.to.position.x, conn.to.position.y, conn.to.position.z);

      const forwardVector = toPosition.clone().sub(fromPosition);
      const distance = forwardVector.length();

      const forwardDirection = distance > 0 ? forwardVector.clone().normalize() : new THREE.Vector3(1, 0, 0);
      const globalUp = new THREE.Vector3(0, 1, 0);

      let planeNormal = forwardDirection.clone().cross(globalUp);
      if (planeNormal.lengthSq() === 0) {
        planeNormal = forwardDirection.clone().cross(new THREE.Vector3(1, 0, 0));
      }
      planeNormal.normalize();

      const curveUp = planeNormal.clone().cross(forwardDirection).normalize();

      const curveHeight = distance > 0 ? Math.max(distance * curveHeightScale, 1e15) : 1e15;

      const positions = new Float32Array((curveSegments + 1) * 3);

      for (let segment = 0; segment <= curveSegments; segment += 1) {
        const t = segment / curveSegments;
        const basePoint = fromPosition.clone().addScaledVector(forwardDirection, distance * t);
        const offset = Math.sin(Math.PI * t) * curveHeight;
        basePoint.addScaledVector(curveUp, offset);

        const index = segment * 3;
        positions[index] = basePoint.x;
        positions[index + 1] = basePoint.y;
        positions[index + 2] = basePoint.z;
      }

      const segmentPositions = new Float32Array(curveSegments * 2 * 3);
      for (let segment = 0; segment < curveSegments; segment += 1) {
        const startIndex = segment * 3;
        const endIndex = (segment + 1) * 3;
        const destIndex = segment * 6;

        segmentPositions[destIndex] = positions[startIndex];
        segmentPositions[destIndex + 1] = positions[startIndex + 1];
        segmentPositions[destIndex + 2] = positions[startIndex + 2];
        segmentPositions[destIndex + 3] = positions[endIndex];
        segmentPositions[destIndex + 4] = positions[endIndex + 1];
        segmentPositions[destIndex + 5] = positions[endIndex + 2];
      }

      const isHighlighted =
        (highlightedRegionId !== null &&
          conn.from.regionID === highlightedRegionId &&
          conn.to.regionID === highlightedRegionId) ||
        highlightedSystemIds.has(conn.from._key) ||
        highlightedSystemIds.has(conn.to._key);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(segmentPositions, 3));

      results.push({
        key: `${conn.from._key}-${conn.to._key}`,
        geometry,
        highlighted: isHighlighted,
      });
    });

    return results;
  }, [connections, curveHeightScale, highlightedRegionId, highlightedSystemIds]);

  useEffect(() => {
    return () => {
      curves.forEach(curve => {
        curve.geometry.dispose();
      });
    };
  }, [curves]);

  return (
    <>
      {curves.map(curve => (
        <lineSegments
          key={curve.key}
          geometry={curve.geometry}
          material={curve.highlighted ? highlightedMaterial : normalMaterial}
        />
      ))}
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

function JumpDriveReachableRing({
  system,
  color,
  opacity,
  scale,
}: {
  system: SolarSystem;
  color: string;
  opacity: number;
  scale: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const baseRadius = SYSTEM_POINT_SIZE * 1.2 * safeScale;
  const ringThickness = baseRadius * 0.05;

  useFrame(() => {
    if (ringRef.current) {
      ringRef.current.lookAt(camera.position);
    }
  });

  return (
    <mesh
      ref={ringRef}
      position={[system.position.x, system.position.y, system.position.z]}
      raycast={() => null}
      renderOrder={-1}
    >
      <ringGeometry args={[Math.max(baseRadius - ringThickness, 0), baseRadius, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// 跳跃引擎可达范围泡泡
function JumpDriveBubble({
  origin,
  radius,
  color,
  opacity,
}: {
  origin: THREE.Vector3;
  radius: number;
  color: string;
  opacity: number;
  wireframeOpacity: number;
}) {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1e12;
  const geometry = useMemo(() => new THREE.SphereGeometry(safeRadius, 64, 64), [safeRadius]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const surfaceOpacity = Math.min(Math.max(opacity, 0), 1);

  return (
    <group position={[origin.x, origin.y, origin.z]}>
      <mesh geometry={geometry} raycast={() => null} renderOrder={-1}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={surfaceOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// 星域标签组件
function RegionLabel({
  region,
  systems,
  language,
  style,
  isHighlighted = false,
}: {
  region: Region;
  systems: SolarSystem[];
  language: Language;
  style?: { labelFontSize?: number; labelColor?: string };
  isHighlighted?: boolean;
}) {
  const textRef = useRef<THREE.Mesh>(null);
  const opacitySetRef = useRef(false); // 跟踪是否已设置透明度
  const { camera } = useThree();
  const baseFontSize = (style?.labelFontSize || 2e15) * 1.5; // 星域标签比系统标签大一些
  const labelOffset = 1e15 * 5; // 星域标签偏移更大

  // 计算星域内所有系统的中心位置
  const regionCenter = useMemo(() => {
    const regionSystems = systems.filter(s => s.regionID === region._key);
    if (regionSystems.length === 0) {
      // 如果没有系统，使用星域的position
      return new THREE.Vector3(region.position.x, region.position.y, region.position.z);
    }
    
    const center = new THREE.Vector3(0, 0, 0);
    regionSystems.forEach(system => {
      center.add(new THREE.Vector3(system.position.x, system.position.y, system.position.z));
    });
    center.divideScalar(regionSystems.length);
    return center;
  }, [region, systems]);

  const setMaterialOpacity = useCallback(() => {
    if (textRef.current?.material && !opacitySetRef.current) {
      const setOpacity = (mat: THREE.Material) => {
        mat.transparent = true;
        mat.opacity = 0.5;
      };
      
      if (Array.isArray(textRef.current.material)) {
        textRef.current.material.forEach(setOpacity);
      } else {
        setOpacity(textRef.current.material);
      }
      opacitySetRef.current = true;
    }
  }, []);

  useFrame(() => {
    if (textRef.current) {
      // 设置半透明效果（只在材质创建后设置一次）
      setMaterialOpacity();
      
      const distanceToCamera = camera.position.distanceTo(regionCenter);
      
      // 确保标签可见
      textRef.current.visible = true;
      
      // 计算从星域中心到相机的方向
      const toCamera = new THREE.Vector3().subVectors(camera.position, regionCenter);
      const cameraDirection = toCamera.clone().normalize();
      
      // 计算标签位置（在垂直于相机方向的平面上）
      const up = new THREE.Vector3(0, 20, 0);
      const rightDirection = new THREE.Vector3();
      rightDirection.crossVectors(up, cameraDirection).normalize();
      
      const labelPosition = new THREE.Vector3()
        .copy(regionCenter)
        .add(rightDirection.clone().multiplyScalar(labelOffset))
        .add(up.clone().multiplyScalar(labelOffset * 0.5)); // 稍微向上偏移
      
      textRef.current.position.copy(labelPosition);
      
      // 标签朝向相机（billboard效果）
      textRef.current.lookAt(camera.position);
      
      // 根据距离调整大小
      const scale = distanceToCamera / (isHighlighted ? 1e17 : 2e17);
      textRef.current.scale.setScalar(scale);
    }
  });

  const regionName = language === 'zh' ? region.name.zh || region.name.en : region.name.en || region.name.zh;
  const labelColor = isHighlighted ? (style?.labelColor || '#ffff00') : '#ffffff'; // 高亮时黄色，普通时蓝色

  return (
    <Text
      ref={textRef}
      position={[regionCenter.x, regionCenter.y, regionCenter.z]}
      fontSize={baseFontSize}
      color={labelColor}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.1}
      outlineColor="#000"
    >
      {regionName || `Region ${region._key}`}
    </Text>
  );
}

// 太阳系标签组件
function SolarSystemLabel({
  system,
  language,
  style,
  isHighlightedRegion = false,
}: {
  system: SolarSystem;
  language: Language;
  style?: { labelFontSize?: number; labelColor?: string };
  isHighlightedRegion?: boolean;
}) {
  const textRef = useRef<THREE.Mesh>(null);
  const positionRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const { camera } = useThree();
  const pointSize = 1e15;
  const baseFontSize = style?.labelFontSize || 1e15;
  // 灰色标签使用更小的字体
  const grayFontSize = baseFontSize * 0.7;
  const labelOffset = pointSize * 3;
  // 灰色标签的最大显示距离（视野拉远后不显示）
  const maxGrayLabelDistance = 5e16;

  useFrame(() => {
    if (textRef.current) {
      const systemPosition = new THREE.Vector3(system.position.x, system.position.y, system.position.z);
      const distanceToCamera = camera.position.distanceTo(systemPosition);
      
      // 如果是灰色标签且距离太远，隐藏标签
      if (isHighlightedRegion && distanceToCamera > maxGrayLabelDistance) {
        textRef.current.visible = false;
        return;
      }
      
      // 确保标签可见
      textRef.current.visible = true;
      
      // 计算从系统点到相机的方向
      const toCamera = new THREE.Vector3().subVectors(camera.position, systemPosition);
      const cameraDirection = toCamera.clone().normalize();
      
      // 计算相机的右向量（在相机坐标系中）
      const cameraRight = new THREE.Vector3();
      const cameraForward = new THREE.Vector3();
      const cameraUp = new THREE.Vector3(0, 1, 0);
      
      camera.getWorldDirection(cameraForward);
      cameraRight.crossVectors(cameraUp, cameraForward).normalize();
      
      // 计算从系统到相机的方向在相机右向量上的投影
      // 我们需要的是在垂直于相机方向的平面上的右方向
      const up = new THREE.Vector3(0, 1, 0);
      const rightDirection = new THREE.Vector3();
      rightDirection.crossVectors(up, cameraDirection).normalize();
      
      const labelPosition = new THREE.Vector3()
        .copy(systemPosition)
        .add(rightDirection.clone().multiplyScalar(labelOffset));
      
      positionRef.current.copy(labelPosition);
      textRef.current.position.copy(labelPosition);
      
      // 标签朝向相机（billboard效果）
      textRef.current.lookAt(camera.position);
      
      // 根据距离调整大小
      const scale = distanceToCamera / 3e16;
      textRef.current.scale.setScalar(scale);
    }
  });

  const systemName = language === 'zh' ? system.name.zh || system.name.en : system.name.en || system.name.zh;
  
  // 如果是高亮星域的系统（但不是高亮系统），使用灰色；否则使用白色
  const labelColor = isHighlightedRegion ? '#888888' : (style?.labelColor || 'white');
  // 灰色标签使用更小的字体
  const fontSize = isHighlightedRegion ? grayFontSize : baseFontSize;

  return (
    <Text
      ref={textRef}
      position={[system.position.x + labelOffset, system.position.y, system.position.z]}
      fontSize={fontSize}
      color={labelColor}
      anchorX="left"
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
  jumpgates = [],
  regions,
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
  externalHighlightedRegionId,
  jumpDriveConfig,
}: {
  systems: SolarSystem[];
  stargates: Stargate[];
  jumpgates?: Jumpgate[];
  regions?: Region[];
  onSystemClick: (system: SolarSystem) => void;
  highlightedRegionId: number | null;
  highlightedSystemIds: Set<number>;
  selectedSystemId: number | null;
  systemRenderConfigs?: SystemRenderConfig[];
  securityColors?: SecurityColorConfig;
  language: Language;
  style?: {
    connectionLineColor?: string;
    connectionLineOpacity?: number;
    highlightedConnectionLineColor?: string;
    jumpgateLineColor?: string;
    jumpgateLineOpacity?: number;
    highlightedJumpgateLineColor?: string;
    labelFontSize?: number;
    labelColor?: string;
    backgroundColor?: string;
  };
  focus?: FocusConfig;
  onFocusComplete?: (config: FocusConfig) => void;
  filterNewEdenOnly?: boolean;
  systemFilter?: (system: SolarSystem) => boolean;
  mapControl?: MapControl;
  externalHighlightedRegionId?: number | null;
  jumpDriveConfig?: JumpDriveConfig;
}) {
  const [filteredSystems, setFilteredSystems] = useState<SolarSystem[]>([]);
  const [connections, setConnections] = useState<Array<{ from: SolarSystem; to: SolarSystem }>>([]);
  const [jumpgateConnections, setJumpgateConnections] = useState<Array<{ from: SolarSystem; to: SolarSystem }>>([]);
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

  const jumpDriveState = useMemo(() => {
    if (!jumpDriveConfig) return null;

    const rangeLightYears = jumpDriveConfig.rangeLightYears;
    if (!Number.isFinite(rangeLightYears) || rangeLightYears <= 0) {
      return null;
    }

    let originVector: THREE.Vector3 | null = null;
    let originSystemId: number | null = null;

    if (jumpDriveConfig.originSystemId !== undefined) {
      const originSystem = systemMap.get(jumpDriveConfig.originSystemId);
      if (originSystem) {
        originVector = new THREE.Vector3(
          originSystem.position.x,
          originSystem.position.y,
          originSystem.position.z
        );
        originSystemId = originSystem._key;
      }
    }

    if (!originVector && jumpDriveConfig.originPosition) {
      const { x, y, z } = jumpDriveConfig.originPosition;
      if ([x, y, z].every(value => Number.isFinite(value))) {
        originVector = new THREE.Vector3(x, y, z);
      }
    }

    if (!originVector) {
      return null;
    }

    const rangeMeters = rangeLightYears * JUMP_DRIVE_LIGHTYEAR_IN_METERS;
    if (!Number.isFinite(rangeMeters) || rangeMeters <= 0) {
      return null;
    }

    const rangeSquared = rangeMeters * rangeMeters;
    const reachableSystems = filteredSystems.filter(system => {
      if (!Number.isFinite(system.securityStatus) || system.securityStatus >= 0.45) {
        return false;
      }
      const dx = system.position.x - originVector!.x;
      const dy = system.position.y - originVector!.y;
      const dz = system.position.z - originVector!.z;
      return dx * dx + dy * dy + dz * dz <= rangeSquared;
    });

    return {
      origin: originVector,
      rangeMeters,
      reachableSystems,
      originSystemId,
    };
  }, [jumpDriveConfig, filteredSystems, systemMap]);

  const effectiveSystemRenderConfigs = useMemo(
    () => (systemRenderConfigs ? [...systemRenderConfigs] : undefined),
    [systemRenderConfigs]
  );

  const jumpDriveHighlightData = useMemo(() => {
    if (!jumpDriveState || jumpDriveConfig?.showReachableSystems === false) {
      return undefined;
    }

    const systems = jumpDriveState.reachableSystems;
    if (systems.length === 0) {
      return undefined;
    }

    const color = jumpDriveConfig?.reachableSystemColor ?? '#00ffff';
    const scale = Math.max(jumpDriveConfig?.reachableSystemSizeMultiplier ?? 1.6, 1.05);
    const opacity = Math.min(Math.max(jumpDriveConfig?.reachableSystemOpacity ?? 0.8, 0), 1);

    return {
      systems,
      color,
      scale,
      opacity,
    };
  }, [jumpDriveState, jumpDriveConfig]);

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

  useEffect(() => {
    if (filteredSystems.length === 0 || !jumpgates || jumpgates.length === 0) {
      setJumpgateConnections([]);
      return;
    }

    const newConnections: Array<{ from: SolarSystem; to: SolarSystem }> = [];
    const systemSet = new Set(filteredSystems.map(s => s._key));
    const connectionSet = new Set<string>();

    jumpgates.forEach(({ fromSystemId, toSystemId }) => {
      const fromSystem = systemMap.get(fromSystemId);
      const toSystem = systemMap.get(toSystemId);

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

    setJumpgateConnections(newConnections);
  }, [filteredSystems, jumpgates, systemMap]);

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

  // 高亮星域时移动相机（只在用户主动选择星域时执行，不包括选中星系导致的高亮）
  useEffect(() => {
    // 只在用户主动选择星域时触发（externalHighlightedRegionId 不为 undefined）
    // 如果 externalHighlightedRegionId 是 undefined，说明是内部高亮（选中星系导致），不触发相机移动
    if (externalHighlightedRegionId === undefined) {
      return;
    }

    if (externalHighlightedRegionId === null || !controlsRef.current || filteredSystems.length === 0) {
      lastHighlightedRegionIdRef.current = externalHighlightedRegionId;
      return;
    }

    // 如果externalHighlightedRegionId没有变化，不执行相机移动
    if (lastHighlightedRegionIdRef.current === externalHighlightedRegionId) return;
    lastHighlightedRegionIdRef.current = externalHighlightedRegionId;

    const regionSystems = filteredSystems.filter(system => system.regionID === externalHighlightedRegionId);
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
  }, [externalHighlightedRegionId, filteredSystems, camera]);

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

      {jumpDriveState && jumpDriveConfig?.showBubble !== false && (
        <JumpDriveBubble
          origin={jumpDriveState.origin}
          radius={jumpDriveState.rangeMeters}
          color={jumpDriveConfig?.bubbleColor ?? '#00ffff'}
          opacity={jumpDriveConfig?.bubbleOpacity ?? 0.12}
        wireframeOpacity={jumpDriveConfig?.bubbleWireframeOpacity ?? 0}
        />
      )}

      {jumpgateConnections.length > 0 && (
        <JumpgateConnections
          connections={jumpgateConnections}
          highlightedRegionId={highlightedRegionId}
          highlightedSystemIds={highlightedSystemIds}
          style={style}
        />
      )}

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
          systemRenderConfigs={effectiveSystemRenderConfigs}
          securityColors={securityColors}
          jumpDriveHighlight={jumpDriveHighlightData}
          jumpDriveConfig={jumpDriveConfig}
        />
      )}

      {/* 显示选中系统的白圈指示器 */}
      {selectedSystemId !== null && (() => {
        const selectedSystem = filteredSystems.find(s => s._key === selectedSystemId);
        if (!selectedSystem) return null;
        return <SelectionRing system={selectedSystem} />;
      })()}

      {/* 显示高亮星域的所有系统的标签 */}
      {highlightedRegionId !== null && filteredSystems
        .filter(system => system.regionID === highlightedRegionId)
        .map(system => (
          <SolarSystemLabel
            key={system._key}
            system={system}
            language={language}
            style={style}
            isHighlightedRegion={!highlightedSystemIds.has(system._key)}
          />
        ))}

      {/* 显示高亮系统的标签（白色，如果不在高亮星域中） */}
      {highlightedRegionId === null && highlightedSystemIds.size > 0 && filteredSystems
        .filter(system => highlightedSystemIds.has(system._key))
        .map(system => (
          <SolarSystemLabel
            key={system._key}
            system={system}
            language={language}
            style={style}
            isHighlightedRegion={false}
          />
        ))}

      {/* 显示星域标签 */}
      {regions && regions.length > 0 && regions
        .filter(region => {
          // 只显示包含已过滤系统的星域
          return filteredSystems.some(system => system.regionID === region._key);
        })
        .map(region => (
          <RegionLabel
            key={region._key}
            region={region}
            systems={filteredSystems}
            language={language}
            style={style}
            isHighlighted={highlightedRegionId === region._key}
          />
        ))}

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

