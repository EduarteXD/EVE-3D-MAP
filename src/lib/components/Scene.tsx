import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type {
	CustomStyleConfig,
	JumpDriveConfig,
	Jumpgate,
	Language,
	MapControl,
	Region,
	SecurityColorConfig,
	SolarSystem,
	Stargate,
	SystemRenderConfig,
} from '../types';
import { isNewEdenSystem } from '../utils';
import { JUMP_DRIVE_LIGHTYEAR_IN_METERS } from './constants';
import { JumpDriveBubble } from './JumpDriveBubble';
import { JumpgateConnections } from './JumpgateConnections';
import { StargateConnections } from './StargateConnections';
import { SolarSystemPoints } from './SolarSystemPoints';
import { SelectionRing } from './SelectionRing';
import { SolarSystemLabel } from './SolarSystemLabel';
import { RegionLabel } from './RegionLabel';
import { Compass2DInternal } from './Compass2D';
import { HomeIcon } from './HomeIcon';
import { detectLabelVisibility, type ProjectedLabel } from './utils/labelOverlapDetection';

export function Scene({
	systems,
	stargates,
	jumpgates = [],
	regions,
	onSystemClick,
	onRegionClick,
	highlightedRegionId,
	highlightedSystemIds,
	selectedSystemId,
	systemRenderConfigs,
	securityColors,
	language,
	style,
	filterNewEdenOnly,
	systemFilter,
	mapControl,
	jumpDriveConfig,
	onCompassRotationChange,
}: {
	systems: SolarSystem[];
	stargates: Stargate[];
	jumpgates?: Jumpgate[];
	regions?: Region[];
	onSystemClick: (system: SolarSystem) => void;
	onRegionClick?: (region: Region) => void;
	highlightedRegionId: number | null;
	highlightedSystemIds: Set<number>;
	selectedSystemId: number | null;
	systemRenderConfigs?: SystemRenderConfig[];
	securityColors?: SecurityColorConfig;
	language: Language;
	style?: CustomStyleConfig;
	filterNewEdenOnly?: boolean;
	systemFilter?: (system: SolarSystem) => boolean;
	mapControl?: MapControl;
	jumpDriveConfig?: JumpDriveConfig;
	onCompassRotationChange?: (rotation: number) => void;
}) {
	const [filteredSystems, setFilteredSystems] = useState<SolarSystem[]>([]);
	const [connections, setConnections] = useState<Array<{ from: SolarSystem; to: SolarSystem }>>([]);
	const [jumpgateConnections, setJumpgateConnections] = useState<Array<{ from: SolarSystem; to: SolarSystem }>>([]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const controlsRef = useRef<any>(null);
	const cameraInitializedRef = useRef(false);
	const { scene, camera } = useThree();

	useEffect(() => {
		if (mapControl?.__internal?.setControlsRef) {
			mapControl.__internal.setControlsRef(controlsRef.current);
		}
	}, [mapControl]);

	useEffect(() => {
		if (mapControl?.__internal?.setSystems) {
			mapControl.__internal.setSystems(filteredSystems);
		}
	}, [mapControl, filteredSystems]);

	useEffect(() => {
		const bgColor = style?.backgroundColor || '#000000';
		const colorValue = bgColor.startsWith('#') ? parseInt(bgColor.replace('#', ''), 16) : parseInt(bgColor, 16);
		scene.background = new THREE.Color(colorValue);
	}, [scene, style]);

	const systemMap = useMemo(() => {
		const map = new Map<number, SolarSystem>();
		systems.forEach((system) => {
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
				originVector = new THREE.Vector3(-originSystem.position.x, -originSystem.position.y, originSystem.position.z);
				originSystemId = originSystem._key;
			}
		}
		if (!originVector && jumpDriveConfig.originPosition) {
			const { x, y, z } = jumpDriveConfig.originPosition;
			if ([x, y, z].every((value) => Number.isFinite(value))) {
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
		const reachableSystems = filteredSystems.filter((system) => {
			if (!Number.isFinite(system.securityStatus) || system.securityStatus >= 0.45) {
				return false;
			}
			const dx = -system.position.x - originVector!.x;
			const dy = -system.position.y - originVector!.y;
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

	const effectiveSystemRenderConfigs = useMemo(() => (systemRenderConfigs ? [...systemRenderConfigs] : undefined), [systemRenderConfigs]);

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
		let filtered = filterNewEdenOnly !== false ? systems.filter((s) => isNewEdenSystem(s._key)) : systems;
		if (systemFilter) {
			filtered = filtered.filter(systemFilter);
		}
		setFilteredSystems(filtered);
	}, [systems, filterNewEdenOnly, systemFilter]);

	useEffect(() => {
		if (filteredSystems.length === 0 || stargates.length === 0) return;
		const newConnections: Array<{ from: SolarSystem; to: SolarSystem }> = [];
		const systemSet = new Set(filteredSystems.map((s) => s._key));
		const connectionSet = new Set<string>();
		stargates.forEach((stargate) => {
			const fromSystem = systemMap.get(stargate.solarSystemID);
			const toSystem = systemMap.get(stargate.destination.solarSystemID);
			if (fromSystem && toSystem && systemSet.has(fromSystem._key) && systemSet.has(toSystem._key)) {
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
		const systemSet = new Set(filteredSystems.map((s) => s._key));
		const connectionSet = new Set<string>();
		jumpgates.forEach(({ fromSystemId, toSystemId }) => {
			const fromSystem = systemMap.get(fromSystemId);
			const toSystem = systemMap.get(toSystemId);
			if (fromSystem && toSystem && systemSet.has(fromSystem._key) && systemSet.has(toSystem._key)) {
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

	// 初始化相机位置（只在没有高亮星域时执行）
	useEffect(() => {
		if (filteredSystems.length === 0 || !controlsRef.current) return;
		if (cameraInitializedRef.current) return;
		if (highlightedRegionId !== null) return;
		
		const box = new THREE.Box3();
		filteredSystems.forEach((system) => {
			const pos = new THREE.Vector3(-system.position.x, -system.position.y, system.position.z);
			box.expandByPoint(pos);
		});
		const center = new THREE.Vector3();
		box.getCenter(center);
		const boxSize = box.getSize(new THREE.Vector3());
		const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z);
		const cameraDistance = maxSize * 1.5;
		const initialPosition = new THREE.Vector3(center.x, center.y + cameraDistance * 0.5, center.z - cameraDistance * 0.8);
		controlsRef.current.target.copy(center);
		controlsRef.current.object.position.copy(initialPosition);
		controlsRef.current.update();
		cameraInitializedRef.current = true;
		if (mapControl?.__internal?.setInitialCameraPosition) {
			mapControl.__internal.setInitialCameraPosition({ x: initialPosition.x, y: initialPosition.y, z: initialPosition.z }, { x: center.x, y: center.y, z: center.z });
		}
	}, [filteredSystems, highlightedRegionId, mapControl]);

	const [visibleRegionIds, setVisibleRegionIds] = useState<Set<number>>(new Set());
	const [visibleSystemIds, setVisibleSystemIds] = useState<Set<number>>(new Set());
	
	const frameCounterRef = useRef(0);
	const lastCameraPositionRef = useRef(new THREE.Vector3());
	const lastCameraTargetRef = useRef(new THREE.Vector3());
	const cameraVelocityRef = useRef(0);
	
	// 动态稳定性阈值：基于相机移动速度调整
	// 相机静止：更新频率降低（阈值增大）
	// 相机移动：更新频率提高（阈值减小）
	const MIN_STABILITY_THRESHOLD = 5;
	const MAX_STABILITY_THRESHOLD = 30;

	const systemsByRegion = useMemo(() => {
		const map = new Map<number, SolarSystem[]>();
		filteredSystems.forEach((system) => {
			const regionSystems = map.get(system.regionID) || [];
			regionSystems.push(system);
			map.set(system.regionID, regionSystems);
		});
		return map;
	}, [filteredSystems]);

	// 缓存需要显示标签的星系列表，避免每次渲染时重复过滤
	const systemsToLabel = useMemo(() => {
		if (highlightedRegionId !== null) {
			return systemsByRegion.get(highlightedRegionId) || [];
		} else if (highlightedSystemIds.size > 0) {
			return filteredSystems.filter((system) => highlightedSystemIds.has(system._key));
		}
		return [];
	}, [highlightedRegionId, highlightedSystemIds, filteredSystems, systemsByRegion]);

	useFrame(() => {
		frameCounterRef.current++;
		
		// 计算相机移动速度
		const currentPosition = camera.position.clone();
		const currentTarget = controlsRef.current?.target?.clone() || new THREE.Vector3();
		
		// 初始化上一帧状态（第一帧）
		if (frameCounterRef.current === 1) {
			lastCameraPositionRef.current.copy(currentPosition);
			lastCameraTargetRef.current.copy(currentTarget);
		}
		
		const positionDelta = currentPosition.distanceTo(lastCameraPositionRef.current);
		const targetDelta = currentTarget.distanceTo(lastCameraTargetRef.current);
		const totalMovement = positionDelta + targetDelta;
		
		// 平滑相机速度（移动平均）
		cameraVelocityRef.current = cameraVelocityRef.current * 0.8 + totalMovement * 0.2;
		
		// 根据相机速度动态调整稳定性阈值
		// 速度快时阈值小（更新频繁），速度慢时阈值大（更新稀疏）
		const velocityNormalized = Math.min(cameraVelocityRef.current / 1e15, 1.0);
		const dynamicThreshold = Math.round(
			MAX_STABILITY_THRESHOLD - velocityNormalized * (MAX_STABILITY_THRESHOLD - MIN_STABILITY_THRESHOLD)
		);
		
		const shouldUpdate = frameCounterRef.current % dynamicThreshold === 0;
		
		if (shouldUpdate) {
			updateRegionLabels();
			updateSystemLabels();
		}
		
		// 更新上一帧的相机状态
		lastCameraPositionRef.current.copy(currentPosition);
		lastCameraTargetRef.current.copy(currentTarget);
	});

	// 区域标签更新逻辑
	function updateRegionLabels() {
		// 没有区域数据，清空可见集合
		if (!regions || regions.length === 0) {
			if (visibleRegionIds.size > 0) {
				setVisibleRegionIds(new Set());
			}
			return;
		}

		const projected: ProjectedLabel[] = [];
		const baseFontSize = (style?.labelFontSize || 2e15) * 1.5;
		const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
		const avgCharWidth = language === 'zh' ? 1.0 : 0.6;

		// 投影所有区域标签
		for (const region of regions) {
			const regionSystems = systemsByRegion.get(region._key);
			if (!regionSystems || regionSystems.length === 0) continue;
			
			// 计算区域中心
			const center = new THREE.Vector3();
			for (const s of regionSystems) {
				center.add(new THREE.Vector3(-s.position.x, -s.position.y, s.position.z));
			}
			center.divideScalar(regionSystems.length);

			const projectedPos = center.clone().project(camera);
			const dist = camera.position.distanceTo(center);
			
			// 视野裁剪
			if (projectedPos.z > 1 || projectedPos.z < -1 || 
			    Math.abs(projectedPos.x) > 1.2 || Math.abs(projectedPos.y) > 1.2) {
				continue;
			}
			
			// 计算屏幕空间尺寸
			const isHighlighted = highlightedRegionId === region._key;
			const scale = dist / (isHighlighted ? 1e17 : 2e17);
			const regionName = language === 'zh' ? region.name.zh || region.name.en : region.name.en || region.name.zh;
			const textLength = regionName?.length || 10;
			
			const worldSize = baseFontSize * scale;
			const screenHeightFactor = 2 * Math.tan(fov / 2) * dist;
			const screenSpaceSize = worldSize / screenHeightFactor;
			
			const screenWidth = screenSpaceSize * textLength * avgCharWidth * 1.2;
			const screenHeight = screenSpaceSize * 1.5;
			
			projected.push({
				id: region._key,
				screenPos: projectedPos,
				dist,
				screenWidth,
				screenHeight,
			});
		}

		// 使用优化的可见性检测并直接更新
		const newVisibleSet = detectLabelVisibility(projected, (a, b) => a.dist - b.dist);
		setVisibleRegionIds(newVisibleSet);
	}

	// 星系标签更新逻辑
	function updateSystemLabels() {
		// 使用缓存的星系列表
		if (systemsToLabel.length === 0) {
			if (visibleSystemIds.size > 0) {
				setVisibleSystemIds(new Set());
			}
			return;
		}

		// 扩展 ProjectedLabel 接口以包含星系特有的属性
		interface ProjectedSystemLabel extends ProjectedLabel {
			isHighlightedRegion: boolean;
		}
		
		const projectedSystems: ProjectedSystemLabel[] = [];
		const baseFontSize = style?.labelFontSize || 1e15;
		const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
		const avgCharWidth = language === 'zh' ? 1.0 : 0.6;
		const maxGrayLabelDistance = 4e17;
		
		// 投影所有星系标签
		for (const system of systemsToLabel) {
			const systemPosition = new THREE.Vector3(-system.position.x, -system.position.y, system.position.z);
			const dist = camera.position.distanceTo(systemPosition);
			
			const isHighlightedRegion = highlightedRegionId !== null && !highlightedSystemIds.has(system._key);
			
			// 距离裁剪
			if (isHighlightedRegion && dist > maxGrayLabelDistance) {
				continue;
			}
			
			const projectedPos = systemPosition.clone().project(camera);
			
			// 视野裁剪
			if (projectedPos.z > 1 || projectedPos.z < -1 || 
				Math.abs(projectedPos.x) > 1.2 || Math.abs(projectedPos.y) > 1.2) {
				continue;
			}
			
			// 计算屏幕空间尺寸
			const scale = dist / 5e16 * (isHighlightedRegion ? 0.9 : 1.3);
			const systemName = language === 'zh' ? system.name.zh || system.name.en : system.name.en || system.name.zh;
			const nameLength = systemName?.length || 10;
			const textLength = nameLength + 4; // +4 for security status " 0.0"
			
			const fontSize = isHighlightedRegion ? baseFontSize * 0.7 : baseFontSize;
			const worldSize = fontSize * scale;
			const screenHeightFactor = 2 * Math.tan(fov / 2) * dist;
			const screenSpaceSize = worldSize / screenHeightFactor;
			
			const screenWidth = screenSpaceSize * textLength * avgCharWidth * 1.3;
			const screenHeight = screenSpaceSize * 1.5;
			
			projectedSystems.push({
				id: system._key,
				screenPos: projectedPos,
				dist,
				screenWidth,
				screenHeight,
				isHighlightedRegion,
			});
		}
		
		// 使用优化的可见性检测并直接更新（自定义排序：非高亮优先，然后按距离）
		const newVisibleSet = detectLabelVisibility(projectedSystems, (a, b) => {
			if (a.isHighlightedRegion !== b.isHighlightedRegion) {
				return a.isHighlightedRegion ? 1 : -1;
			}
			return a.dist - b.dist;
		});
		setVisibleSystemIds(newVisibleSet);
	}

	return (
		<>
			<ambientLight intensity={0.5} />
			<pointLight position={[0, 0, 0]} intensity={1} />
			{jumpDriveState && jumpDriveConfig?.showBubble !== false && (
				<JumpDriveBubble origin={jumpDriveState.origin} radius={jumpDriveState.rangeMeters} color={jumpDriveConfig?.bubbleColor ?? '#00ffff'} opacity={jumpDriveConfig?.bubbleOpacity ?? 0.12} />
			)}
			{jumpgateConnections.length > 0 && (
				<JumpgateConnections connections={jumpgateConnections} highlightedRegionId={highlightedRegionId} highlightedSystemIds={highlightedSystemIds} style={style} />
			)}
			{connections.length > 0 && (
				<StargateConnections connections={connections} highlightedRegionId={highlightedRegionId} highlightedSystemIds={highlightedSystemIds} style={style} />
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
					mapControl={mapControl}
				/>
			)}
			{selectedSystemId !== null &&
				(() => {
					const selectedSystem = filteredSystems.find((s) => s._key === selectedSystemId);
					if (!selectedSystem) return null;
					return <SelectionRing system={selectedSystem} />;
				})()}
			{jumpDriveState && jumpDriveState.originSystemId !== null &&
				(() => {
					const originSystem = filteredSystems.find((s) => s._key === jumpDriveState.originSystemId);
					if (!originSystem) return null;
					return <HomeIcon system={originSystem} onSystemClick={onSystemClick} />;
				})()}
			{systemsToLabel.length > 0 &&
				systemsToLabel.map((system) => (
					<SolarSystemLabel 
						key={system._key} 
						system={system} 
						language={language} 
						style={style} 
						isHighlightedRegion={highlightedRegionId !== null && !highlightedSystemIds.has(system._key)}
						visible={visibleSystemIds.has(system._key)}
					/>
				))}
			{regions &&
				regions.length > 0 &&
				regions
					.filter((region) => filteredSystems.some((s) => s.regionID === region._key))
					.map((region) => (
						<RegionLabel
							key={region._key}
							region={region}
							systems={filteredSystems}
							language={language}
							style={style}
							isHighlighted={highlightedRegionId === region._key}
							visible={visibleRegionIds.has(region._key)}
							onClick={onRegionClick}
							mapControl={mapControl}
						/>
					))}
			<OrbitControls ref={controlsRef} enablePan={true} enableZoom={true} enableRotate={true} minDistance={7e16} maxDistance={1e18} autoRotate={false} zoomSpeed={-1} />
			{onCompassRotationChange && <Compass2DInternal onRotationChange={onCompassRotationChange} />}
		</>
	);
}

