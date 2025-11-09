import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import { loadSolarSystems, loadStargates, loadRegions, isNewEdenSystem, type SolarSystem, type Stargate, type Region } from '../utils/loadEveData';

// 批量渲染太阳系点的组件 - 使用InstancedMesh
function SolarSystemPoints({ 
  systems, 
  onSystemClick,
  highlightedRegionId 
}: { 
  systems: SolarSystem[];
  onSystemClick: (system: SolarSystem) => void;
  highlightedRegionId: number | null;
}) {
  // 普通系统和高亮系统的引用
  const highsecNormalRef = useRef<THREE.InstancedMesh>(null);
  const highsecHighlightRef = useRef<THREE.InstancedMesh>(null);
  const lowsecNormalRef = useRef<THREE.InstancedMesh>(null);
  const lowsecHighlightRef = useRef<THREE.InstancedMesh>(null);
  const nullsecNormalRef = useRef<THREE.InstancedMesh>(null);
  const nullsecHighlightRef = useRef<THREE.InstancedMesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const { camera, gl } = useThree();
  const pointSize = 1e15;

  // 创建几何体和材质
  const normalGeometry = useMemo(() => new THREE.SphereGeometry(pointSize, 16, 16), []);
  const highlightGeometry = useMemo(() => new THREE.SphereGeometry(pointSize * 1.5, 16, 16), []);
  
  const materials = useMemo(() => {
    const baseMaterials = {
      highsec: new THREE.MeshBasicMaterial({ color: '#4CAF50', transparent: true, opacity: 0.9 }),
      lowsec: new THREE.MeshBasicMaterial({ color: '#FF9800', transparent: true, opacity: 0.9 }),
      nullsec: new THREE.MeshBasicMaterial({ color: '#F44336', transparent: true, opacity: 0.9 }),
    };
    
    // 高亮材质（更亮、更大）
    const highlightMaterials = {
      highsec: new THREE.MeshBasicMaterial({ color: '#66FF66', transparent: true, opacity: 1.0 }),
      lowsec: new THREE.MeshBasicMaterial({ color: '#FFB84D', transparent: true, opacity: 1.0 }),
      nullsec: new THREE.MeshBasicMaterial({ color: '#FF6666', transparent: true, opacity: 1.0 }),
    };
    
    return { baseMaterials, highlightMaterials };
  }, []);

  // 按安全等级分组系统，并区分高亮和非高亮
  const systemGroups = useMemo(() => {
    const groups = {
      highsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
      lowsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
      nullsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
    };
    
    systems.forEach(system => {
      const isHighlighted = highlightedRegionId !== null && system.regionID === highlightedRegionId;
      const category = system.securityStatus >= 0.45 ? 'highsec' : 
                      system.securityStatus >= 0.0 ? 'lowsec' : 'nullsec';
      
      if (isHighlighted) {
        groups[category].highlighted.push(system);
      } else {
        groups[category].normal.push(system);
      }
    });
    
    return groups;
  }, [systems, highlightedRegionId]);

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
  }, [systemGroups]);

  // 处理点击事件
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      // 检查所有InstancedMesh（包括普通和高亮）
      const meshes = [
        { ref: highsecNormalRef, systems: systemGroups.highsec.normal },
        { ref: highsecHighlightRef, systems: systemGroups.highsec.highlighted },
        { ref: lowsecNormalRef, systems: systemGroups.lowsec.normal },
        { ref: lowsecHighlightRef, systems: systemGroups.lowsec.highlighted },
        { ref: nullsecNormalRef, systems: systemGroups.nullsec.normal },
        { ref: nullsecHighlightRef, systems: systemGroups.nullsec.highlighted },
      ];

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
  }, [gl, camera, raycaster, mouse, systemGroups, onSystemClick]);

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
    </>
  );
}

// 合并的星门连接线组件
function StargateConnections({ 
  connections,
  highlightedRegionId
}: { 
  connections: Array<{ from: SolarSystem; to: SolarSystem }>;
  highlightedRegionId: number | null;
}) {
  // 将连接分为普通和高亮两组
  const { normalConnections, highlightedConnections } = useMemo(() => {
    const normal: Array<{ from: SolarSystem; to: SolarSystem }> = [];
    const highlighted: Array<{ from: SolarSystem; to: SolarSystem }> = [];
    
    if (highlightedRegionId === null) {
      // 没有高亮时，所有连接都是普通连接
      return { normalConnections: connections, highlightedConnections: [] };
    }
    
    connections.forEach(conn => {
      // 如果连接的两个系统都在高亮星域内，则高亮
      if (conn.from.regionID === highlightedRegionId && 
          conn.to.regionID === highlightedRegionId) {
        highlighted.push(conn);
      } else {
        normal.push(conn);
      }
    });
    
    return { normalConnections: normal, highlightedConnections: highlighted };
  }, [connections, highlightedRegionId]);

  // 普通连接的几何体
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

  // 高亮连接的几何体
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

  // 普通连接材质
  const normalMaterial = useMemo(() => 
    new THREE.LineBasicMaterial({ 
      color: '#4488ff', 
      transparent: true, 
      opacity: 0.3 
    }), 
  []);

  // 高亮连接材质 - 更亮更明显（青色，完全不透明）
  const highlightedMaterial = useMemo(() => 
    new THREE.LineBasicMaterial({ 
      color: '#00ffff', 
      transparent: false, 
      opacity: 1.0
    }), 
  []);

  return (
    <>
      {/* 普通连接 */}
      {normalConnections.length > 0 && (
        <lineSegments geometry={normalLineGeometry} material={normalMaterial} />
      )}
      {/* 高亮连接 */}
      {highlightedConnections.length > 0 && (
        <lineSegments geometry={highlightedLineGeometry} material={highlightedMaterial} />
      )}
    </>
  );
}

// 太阳系标签组件
function SolarSystemLabel({ 
  system
}: { 
  system: SolarSystem;
}) {
  return (
    <Text
      position={[system.position.x, system.position.y + 2e15, system.position.z]}
      fontSize={5e14}
      color="white"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.02}
      outlineColor="#000"
    >
      {system.name.zh || system.name.en || String(system._key)}
    </Text>
  );
}

// 主场景组件
function Scene({ 
  systems, 
  stargates,
  selectedSystem, 
  onSystemClick,
  highlightedRegionId
}: { 
  systems: SolarSystem[];
  stargates: Stargate[];
  selectedSystem: SolarSystem | null;
  onSystemClick: (system: SolarSystem) => void;
  highlightedRegionId: number | null;
}) {
  const [filteredSystems, setFilteredSystems] = useState<SolarSystem[]>([]);
  const [connections, setConnections] = useState<Array<{ from: SolarSystem; to: SolarSystem }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const { scene, camera } = useThree();
  
  // 设置黑色背景
  useEffect(() => {
    scene.background = new THREE.Color(0x000000);
  }, [scene]);

  // 创建太阳系ID到太阳系对象的映射
  const systemMap = useMemo(() => {
    const map = new Map<number, SolarSystem>();
    systems.forEach(system => {
      map.set(system._key, system);
    });
    return map;
  }, [systems]);

  useEffect(() => {
    // 只显示New Eden太阳系（游戏内地图显示的）
    const newEdenSystems = systems.filter(s => isNewEdenSystem(s._key));
    setFilteredSystems(newEdenSystems);
  }, [systems]);

  // 构建星门连接 - 优化版本，使用Set去重
  useEffect(() => {
    if (filteredSystems.length === 0 || stargates.length === 0) return;

    const newConnections: Array<{ from: SolarSystem; to: SolarSystem }> = [];
    const systemSet = new Set(filteredSystems.map(s => s._key));
    const connectionSet = new Set<string>(); // 用于快速去重

    stargates.forEach(stargate => {
      const fromSystem = systemMap.get(stargate.solarSystemID);
      const toSystem = systemMap.get(stargate.destination.solarSystemID);

      // 只添加两个太阳系都在New Eden范围内的连接
      if (fromSystem && toSystem && 
          systemSet.has(fromSystem._key) && 
          systemSet.has(toSystem._key)) {
        // 使用排序后的ID对作为key，避免重复
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

  // 计算所有太阳系的中心点和范围，用于相机定位（初始加载时）
  useEffect(() => {
    if (filteredSystems.length === 0 || !controlsRef.current) return;
    
    // 只在没有高亮星域时才执行初始定位
    if (highlightedRegionId !== null) return;

    const box = new THREE.Box3();
    filteredSystems.forEach(system => {
      const pos = new THREE.Vector3(
        system.position.x,
        system.position.y,
        system.position.z
      );
      box.expandByPoint(pos);
    });
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    const boxSize = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z);
    
    // 将相机移动到中心点，并设置合适的距离
    const cameraDistance = maxSize * 1.5;
    controlsRef.current.target.copy(center);
    controlsRef.current.object.position.set(
      center.x,
      center.y + cameraDistance * 0.5,
      center.z + cameraDistance * 0.8
    );
    controlsRef.current.update();
  }, [filteredSystems, highlightedRegionId]);

  // 当高亮星域改变时，平滑移动摄像机到星域中心
  useEffect(() => {
    if (highlightedRegionId === null || !controlsRef.current || filteredSystems.length === 0) return;

    // 找到属于该星域的所有系统
    const regionSystems = filteredSystems.filter(system => system.regionID === highlightedRegionId);
    
    if (regionSystems.length === 0) return;

    // 计算星域系统的边界框
    const box = new THREE.Box3();
    regionSystems.forEach(system => {
      const pos = new THREE.Vector3(
        system.position.x,
        system.position.y,
        system.position.z
      );
      box.expandByPoint(pos);
    });
    
    const targetCenter = new THREE.Vector3();
    box.getCenter(targetCenter);
    const boxSize = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z);
    
    // 计算目标摄像机位置和距离
    const cameraDistance = maxSize * 1.5;
    const targetPosition = new THREE.Vector3(
      targetCenter.x,
      targetCenter.y + cameraDistance * 0.5,
      targetCenter.z + cameraDistance * 0.8
    );

    // 获取当前摄像机位置和目标
    const startTarget = controlsRef.current.target.clone();
    const startPosition = camera.position.clone();

    // 平滑动画参数
    const duration = 1500; // 动画时长（毫秒）
    const startTime = Date.now();
    let animationFrameId: number;

    // 缓动函数（ease-in-out）
    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      // 插值计算当前位置和目标
      const currentTarget = startTarget.clone().lerp(targetCenter, easedProgress);
      const currentPosition = startPosition.clone().lerp(targetPosition, easedProgress);

      // 更新摄像机
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

  return (
    <>
      {/* 背景星空 */}
      <Stars radius={1e18} depth={50} count={5000} factor={4} fade speed={1} />

      {/* 环境光 */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={1} />

      {/* 渲染星门连接线 - 合并为一个几何体 */}
      {connections.length > 0 && (
        <StargateConnections 
          connections={connections} 
          highlightedRegionId={highlightedRegionId}
        />
      )}

      {/* 批量渲染太阳系点 */}
      {filteredSystems.length > 0 && (
        <SolarSystemPoints
          systems={filteredSystems}
          onSystemClick={onSystemClick}
          highlightedRegionId={highlightedRegionId}
        />
      )}

      {/* 渲染标签（仅显示选中的） */}
      {selectedSystem && (
        <SolarSystemLabel system={selectedSystem} />
      )}

      {/* 相机控制 */}
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
export default function EveMap3D() {
  const [systems, setSystems] = useState<SolarSystem[]>([]);
  const [stargates, setStargates] = useState<Stargate[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<SolarSystem | null>(null);
  const [highlightedRegionId, setHighlightedRegionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadSolarSystems(),
      loadStargates(),
      loadRegions()
    ])
      .then(([systemsData, stargatesData, regionsData]) => {
        setSystems(systemsData);
        setStargates(stargatesData);
        setRegions(regionsData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 计算New Eden连接数（用于显示）
  const newEdenSystems = useMemo(() => 
    systems.filter(s => isNewEdenSystem(s._key)), 
    [systems]
  );

  const newEdenConnections = useMemo(() => {
    if (newEdenSystems.length === 0 || stargates.length === 0) return 0;
    
    const systemSet = new Set(newEdenSystems.map(s => s._key));
    const systemMap = new Map(systems.map(s => [s._key, s]));
    const connectionSet = new Set<string>();
    
    stargates.forEach(stargate => {
      const fromSystem = systemMap.get(stargate.solarSystemID);
      const toSystem = systemMap.get(stargate.destination.solarSystemID);
      
      if (fromSystem && toSystem && 
          systemSet.has(fromSystem._key) && 
          systemSet.has(toSystem._key)) {
        const minId = Math.min(fromSystem._key, toSystem._key);
        const maxId = Math.max(fromSystem._key, toSystem._key);
        const key = `${minId}-${maxId}`;
        connectionSet.add(key);
      }
    });
    
    return connectionSet.size;
  }, [systems, stargates, newEdenSystems]);

  if (loading) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        color: '#fff'
      }}>
        <div>加载星图数据中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        color: '#f00'
      }}>
        <div>错误: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
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
          selectedSystem={selectedSystem}
          onSystemClick={setSelectedSystem}
          highlightedRegionId={highlightedRegionId}
        />
      </Canvas>

      {/* UI控制面板 */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '15px',
        borderRadius: '8px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '14px',
        maxWidth: '300px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>EVE 3D 星图</h3>
        <div>太阳系总数: {newEdenSystems.length}</div>
        <div>星门连接: {newEdenConnections}</div>
        
        {/* 星域高亮选择器 */}
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
          <div><strong>高亮星域:</strong></div>
          <select
            value={highlightedRegionId || ''}
            onChange={(e) => setHighlightedRegionId(e.target.value ? Number(e.target.value) : null)}
            style={{
              width: '100%',
              marginTop: '5px',
              padding: '5px',
              background: '#222',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value="">无</option>
            {regions
              .filter(region => {
                // 只显示在New Eden中有系统的星域
                return newEdenSystems.some(system => system.regionID === region._key);
              })
              .sort((a, b) => {
                const nameA = a.name.zh || a.name.en || '';
                const nameB = b.name.zh || b.name.en || '';
                return nameA.localeCompare(nameB, 'zh-CN');
              })
              .map(region => (
                <option key={region._key} value={region._key}>
                  {region.name.zh || region.name.en || `Region ${region._key}`}
                </option>
              ))}
          </select>
        </div>

        {selectedSystem && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
            <div><strong>选中系统:</strong></div>
            <div>名称: {selectedSystem.name.zh || selectedSystem.name.en}</div>
            <div>ID: {selectedSystem._key}</div>
            <div>安全等级: {selectedSystem.securityStatus.toFixed(2)}</div>
            <div>坐标: ({selectedSystem.position.x.toExponential(2)}, {selectedSystem.position.y.toExponential(2)}, {selectedSystem.position.z.toExponential(2)})</div>
          </div>
        )}
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#aaa' }}>
          <div>操作说明:</div>
          <div>• 鼠标左键拖拽: 旋转</div>
          <div>• 鼠标右键拖拽: 平移</div>
          <div>• 滚轮: 缩放</div>
          <div>• 点击太阳系: 查看详情</div>
          <div>• 选择星域: 高亮显示</div>
        </div>
      </div>
    </div>
  );
}
