import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type {
	EveMap3DProps,
	FocusConfig,
	JumpDriveConfig,
	Jumpgate,
	Language,
	MapControl,
	Region,
	SecurityColorConfig,
	SolarSystem,
	Stargate,
	SystemRenderConfig,
} from '../../types';
import { isNewEdenSystem } from '../../utils';
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
	focus,
	onFocusComplete,
	filterNewEdenOnly,
	systemFilter,
	mapControl,
	externalHighlightedRegionId,
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
	style?: EveMap3DProps['style'];
	focus?: FocusConfig;
	onFocusComplete?: (config: FocusConfig) => void;
	filterNewEdenOnly?: boolean;
	systemFilter?: (system: SolarSystem) => boolean;
	mapControl?: MapControl;
	externalHighlightedRegionId?: number | null;
	jumpDriveConfig?: JumpDriveConfig;
	onCompassRotationChange?: (rotation: number) => void;
}) {
	const [filteredSystems, setFilteredSystems] = useState<SolarSystem[]>([]);
	const [connections, setConnections] = useState<Array<{ from: SolarSystem; to: SolarSystem }>>([]);
	const [jumpgateConnections, setJumpgateConnections] = useState<Array<{ from: SolarSystem; to: SolarSystem }>>([]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const controlsRef = useRef<any>(null);
	const cameraInitializedRef = useRef(false);
	const lastHighlightedRegionIdRef = useRef<number | null>(null);
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

	useEffect(() => {
		if (filteredSystems.length === 0 || !controlsRef.current) return;
		if (cameraInitializedRef.current) return;
		if (highlightedRegionId !== null || focus) return;
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
	}, [filteredSystems, highlightedRegionId, focus, mapControl]);

	useEffect(() => {
		if (externalHighlightedRegionId === undefined) {
			return;
		}
		if (externalHighlightedRegionId === null || !controlsRef.current || filteredSystems.length === 0) {
			lastHighlightedRegionIdRef.current = externalHighlightedRegionId;
			return;
		}
		if (lastHighlightedRegionIdRef.current === externalHighlightedRegionId) return;
		lastHighlightedRegionIdRef.current = externalHighlightedRegionId;
		const regionSystems = filteredSystems.filter((system) => system.regionID === externalHighlightedRegionId);
		if (regionSystems.length === 0) return;
		const box = new THREE.Box3();
		regionSystems.forEach((system) => {
			const pos = new THREE.Vector3(-system.position.x, -system.position.y, system.position.z);
			box.expandByPoint(pos);
		});
		const targetCenter = new THREE.Vector3();
		box.getCenter(targetCenter);
		const boxSize = box.getSize(new THREE.Vector3());
		const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z);
		const cameraDistance = maxSize * 1.5;
		const targetPosition = new THREE.Vector3(targetCenter.x, targetCenter.y + cameraDistance * 0.5, targetCenter.z - cameraDistance * 0.8);
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

	useEffect(() => {
		if (!focus || !controlsRef.current || filteredSystems.length === 0) return;
		let targetSystems: SolarSystem[] = [];
		if (focus.type === 'system') {
			const system = filteredSystems.find((s) => s._key === focus.targetId);
			if (system) targetSystems = [system];
		} else if (focus.type === 'region') {
			targetSystems = filteredSystems.filter((s) => s.regionID === focus.targetId);
		}
		if (targetSystems.length === 0) return;
		const box = new THREE.Box3();
		targetSystems.forEach((system) => {
			const pos = new THREE.Vector3(-system.position.x, -system.position.y, system.position.z);
			box.expandByPoint(pos);
		});
		const targetCenter = new THREE.Vector3();
		box.getCenter(targetCenter);
		const boxSize = box.getSize(new THREE.Vector3());
		const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z);
		const cameraDistance = maxSize * 1.5;
		const targetPosition = new THREE.Vector3(targetCenter.x, targetCenter.y + cameraDistance * 0.5, targetCenter.z - cameraDistance * 0.8);
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

	const [visibleRegionIds, setVisibleRegionIds] = useState<Set<number>>(new Set());

	useFrame(() => {
		if (!regions || regions.length === 0) return;
		const projected: { id: number; screenPos: THREE.Vector3; dist: number }[] = [];

		regions.forEach((region) => {
			const regionSystems = filteredSystems.filter((s) => s.regionID === region._key);
			if (regionSystems.length === 0) return;
			const center = new THREE.Vector3();
			regionSystems.forEach((s) =>
				center.add(new THREE.Vector3(-s.position.x, -s.position.y, s.position.z))
			);
			center.divideScalar(regionSystems.length);

			const projectedPos = center.clone().project(camera);
			projected.push({
				id: region._key,
				screenPos: projectedPos,
				dist: camera.position.distanceTo(center),
			});
		});

		const visible = new Set<number>();
		const threshold = 0.04;
		projected.forEach((a) => {
			const overlapped = projected.some(
				(b) =>
					a !== b &&
					Math.abs(a.screenPos.x - b.screenPos.x) < threshold &&
					Math.abs(a.screenPos.y - b.screenPos.y) < threshold &&
					b.dist < a.dist
			);
			if (!overlapped) visible.add(a.id);
		});
		setVisibleRegionIds(visible);
	});

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
			{highlightedRegionId !== null &&
				filteredSystems
					.filter((system) => system.regionID === highlightedRegionId)
					.map((system) => (
						<SolarSystemLabel key={system._key} system={system} language={language} style={style} isHighlightedRegion={!highlightedSystemIds.has(system._key)} />
					))}
			{highlightedRegionId === null &&
				highlightedSystemIds.size > 0 &&
				filteredSystems
					.filter((system) => highlightedSystemIds.has(system._key))
					.map((system) => <SolarSystemLabel key={system._key} system={system} language={language} style={style} isHighlightedRegion={false} />)}
			{/* {regions &&
				regions.length > 0 &&
				regions
					.filter((region) => {
						return filteredSystems.some((system) => system.regionID === region._key);
					})
					.map((region) => (
						<RegionLabel key={region._key} region={region} systems={filteredSystems} language={language} style={style} isHighlighted={highlightedRegionId === region._key} onClick={onRegionClick} />
					))} */}
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
						/>
					))}
			<OrbitControls ref={controlsRef} enablePan={true} enableZoom={true} enableRotate={true} minDistance={1e15} maxDistance={1e18} autoRotate={false} zoomSpeed={-1} />
			{onCompassRotationChange && <Compass2DInternal onRotationChange={onCompassRotationChange} />}
		</>
	);
}


