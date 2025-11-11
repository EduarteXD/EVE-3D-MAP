import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { JumpDriveConfig, MapControl, SecurityColorConfig, SolarSystem, SystemRenderConfig } from '../types';
import { DEFAULT_HIGHLIGHT_COLORS, DEFAULT_SECURITY_COLORS, SYSTEM_POINT_SIZE } from './constants';
import { clampSystemPointBaseScale } from './utils/utils';
import { JumpDriveReachableRing } from './JumpDriveReachableRing';

export function SolarSystemPoints({
	systems,
	onSystemClick,
	highlightedRegionId,
	highlightedSystemIds,
	systemRenderConfigs,
	securityColors,
	jumpDriveHighlight,
	jumpDriveConfig,
	mapControl,
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
	mapControl?: MapControl;
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

	const mergedSecurityColors = useMemo(
		() => ({
			highsec: securityColors?.highsec || DEFAULT_SECURITY_COLORS.highsec,
			lowsec: securityColors?.lowsec || DEFAULT_SECURITY_COLORS.lowsec,
			nullsec: securityColors?.nullsec || DEFAULT_SECURITY_COLORS.nullsec,
		}),
		[securityColors],
	);

	const mergedHighlightColors = useMemo(
		() => ({
			highsec: DEFAULT_HIGHLIGHT_COLORS.highsec,
			lowsec: DEFAULT_HIGHLIGHT_COLORS.lowsec,
			nullsec: DEFAULT_HIGHLIGHT_COLORS.nullsec,
		}),
		[],
	);

	const normalGeometry = useMemo(() => new THREE.SphereGeometry(SYSTEM_POINT_SIZE, 32, 32), []);
	const highlightGeometry = useMemo(() => new THREE.SphereGeometry(SYSTEM_POINT_SIZE * 1.5, 32, 32), []);

	const materials = useMemo(() => {
		const baseMaterials = {
			highsec: new THREE.MeshBasicMaterial({
				color: mergedSecurityColors.highsec,
				transparent: true,
				opacity: 0.7,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
			lowsec: new THREE.MeshBasicMaterial({
				color: mergedSecurityColors.lowsec,
				transparent: true,
				opacity: 0.7,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
			nullsec: new THREE.MeshBasicMaterial({
				color: mergedSecurityColors.nullsec,
				transparent: true,
				opacity: 0.7,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
		};

		const highlightMaterials = {
			highsec: new THREE.MeshBasicMaterial({
				color: mergedHighlightColors.highsec,
				transparent: true,
				opacity: 0.85,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
			lowsec: new THREE.MeshBasicMaterial({
				color: mergedHighlightColors.lowsec,
				transparent: true,
				opacity: 0.85,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
			nullsec: new THREE.MeshBasicMaterial({
				color: mergedHighlightColors.nullsec,
				transparent: true,
				opacity: 0.85,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
		};

		return { baseMaterials, highlightMaterials };
	}, [mergedSecurityColors, mergedHighlightColors]);

	const systemConfigMap = useMemo(() => {
		if (!systemRenderConfigs) return new Map<number, SystemRenderConfig>();
		return new Map(systemRenderConfigs.map((config) => [config.systemId, config]));
	}, [systemRenderConfigs]);

	const systemGroups = useMemo(() => {
		const groups = {
			highsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
			lowsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
			nullsec: { normal: [] as SolarSystem[], highlighted: [] as SolarSystem[] },
			custom: [] as Array<{ system: SolarSystem; config: SystemRenderConfig }>,
		};

		systems.forEach((system) => {
			const customConfig = systemConfigMap.get(system._key);

			if (customConfig) {
				groups.custom.push({ system, config: customConfig });
				return;
			}

			const isHighlighted =
				(highlightedRegionId !== null && system.regionID === highlightedRegionId) ||
				highlightedSystemIds.has(system._key);
			const category = system.securityStatus >= 0.45 ? 'highsec' : system.securityStatus >= 0.0 ? 'lowsec' : 'nullsec';

			if (isHighlighted) {
				groups[category].highlighted.push(system);
			} else {
				groups[category].normal.push(system);
			}
		});

		return groups;
	}, [systems, highlightedRegionId, highlightedSystemIds, systemConfigMap]);

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

	const customMaterialsAndGeometries = useMemo(() => {
		const result = new Map<string, { material: THREE.MeshBasicMaterial; geometry: THREE.SphereGeometry }>();
		customSystemGroups.forEach((items, key) => {
			if (!result.has(key)) {
				const config = items[0].config;
				const color = config.color || mergedSecurityColors.highsec;
				const opacity = config.opacity !== undefined ? config.opacity : 0.7;
				const scale = clampSystemPointBaseScale(config.size ?? 1.0);
				const isHighlighted = config.highlighted || false;

				result.set(key, {
					material: new THREE.MeshBasicMaterial({
						color,
						transparent: true,
						opacity: isHighlighted ? Math.min(opacity * 1.2, 1.0) : opacity,
						blending: THREE.AdditiveBlending,
						depthWrite: false,
					}),
					geometry: new THREE.SphereGeometry(SYSTEM_POINT_SIZE * scale, 32, 32),
				});
			}
		});
		return result;
	}, [customSystemGroups, mergedSecurityColors]);

	useEffect(() => {
		const matrix = new THREE.Matrix4();

		if (highsecNormalRef.current) {
			systemGroups.highsec.normal.forEach((system, index) => {
				matrix.setPosition(-system.position.x, -system.position.y, system.position.z);
				highsecNormalRef.current!.setMatrixAt(index, matrix);
			});
			highsecNormalRef.current.instanceMatrix.needsUpdate = true;
		}

		if (highsecHighlightRef.current) {
			systemGroups.highsec.highlighted.forEach((system, index) => {
				matrix.setPosition(-system.position.x, -system.position.y, system.position.z);
				highsecHighlightRef.current!.setMatrixAt(index, matrix);
			});
			highsecHighlightRef.current.instanceMatrix.needsUpdate = true;
		}

		if (lowsecNormalRef.current) {
			systemGroups.lowsec.normal.forEach((system, index) => {
				matrix.setPosition(-system.position.x, -system.position.y, system.position.z);
				lowsecNormalRef.current!.setMatrixAt(index, matrix);
			});
			lowsecNormalRef.current.instanceMatrix.needsUpdate = true;
		}

		if (lowsecHighlightRef.current) {
			systemGroups.lowsec.highlighted.forEach((system, index) => {
				matrix.setPosition(-system.position.x, -system.position.y, system.position.z);
				lowsecHighlightRef.current!.setMatrixAt(index, matrix);
			});
			lowsecHighlightRef.current.instanceMatrix.needsUpdate = true;
		}

		if (nullsecNormalRef.current) {
			systemGroups.nullsec.normal.forEach((system, index) => {
				matrix.setPosition(-system.position.x, -system.position.y, system.position.z);
				nullsecNormalRef.current!.setMatrixAt(index, matrix);
			});
			nullsecNormalRef.current.instanceMatrix.needsUpdate = true;
		}

		if (nullsecHighlightRef.current) {
			systemGroups.nullsec.highlighted.forEach((system, index) => {
				matrix.setPosition(-system.position.x, -system.position.y, system.position.z);
				nullsecHighlightRef.current!.setMatrixAt(index, matrix);
			});
			nullsecHighlightRef.current.instanceMatrix.needsUpdate = true;
		}

		customSystemGroups.forEach((items, key) => {
			const ref = customSystemsRefs.current.get(key);
			if (ref) {
				items.forEach(({ system }, index) => {
					matrix.setPosition(-system.position.x, -system.position.y, system.position.z);
					ref.setMatrixAt(index, matrix);
				});
				ref.instanceMatrix.needsUpdate = true;
			}
		});
	}, [systemGroups, customSystemGroups]);

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

			customSystemGroups.forEach((items, key) => {
				const ref = customSystemsRefs.current.get(key);
				if (ref) {
					meshes.push({
						ref: { current: ref },
						systems: items.map((item) => item.system),
					});
				}
			});

			for (const { ref, systems: groupSystems } of meshes) {
				if (ref.current) {
					ref.current.computeBoundingSphere();
					ref.current.computeBoundingBox();
					const intersects = raycaster.intersectObject(ref.current);
					if (intersects.length > 0) {
						const instanceId = intersects[0].instanceId!;
						if (instanceId < groupSystems.length) {
							onSystemClick(groupSystems[instanceId]);
							mapControl?.getConfig().events?.onSystemClick?.(groupSystems[instanceId]);
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
	}, [gl, camera, raycaster, mouse, systemGroups, customSystemGroups, onSystemClick, mapControl]);

	return (
		<>
			{systemGroups.highsec.normal.length > 0 && (
				<instancedMesh key={`highsec-normal-${systemGroups.highsec.normal.length}`} ref={highsecNormalRef} args={[normalGeometry, materials.baseMaterials.highsec, systemGroups.highsec.normal.length]} />
			)}
			{systemGroups.highsec.highlighted.length > 0 && (
				<instancedMesh key={`highsec-highlighted-${systemGroups.highsec.highlighted.length}`} ref={highsecHighlightRef} args={[highlightGeometry, materials.highlightMaterials.highsec, systemGroups.highsec.highlighted.length]} />
			)}
			{systemGroups.lowsec.normal.length > 0 && (
				<instancedMesh key={`lowsec-normal-${systemGroups.lowsec.normal.length}`} ref={lowsecNormalRef} args={[normalGeometry, materials.baseMaterials.lowsec, systemGroups.lowsec.normal.length]} />
			)}
			{systemGroups.lowsec.highlighted.length > 0 && (
				<instancedMesh key={`lowsec-highlighted-${systemGroups.lowsec.highlighted.length}`} ref={lowsecHighlightRef} args={[highlightGeometry, materials.highlightMaterials.lowsec, systemGroups.lowsec.highlighted.length]} />
			)}
			{systemGroups.nullsec.normal.length > 0 && (
				<instancedMesh key={`nullsec-normal-${systemGroups.nullsec.normal.length}`} ref={nullsecNormalRef} args={[normalGeometry, materials.baseMaterials.nullsec, systemGroups.nullsec.normal.length]} />
			)}
			{systemGroups.nullsec.highlighted.length > 0 && (
				<instancedMesh key={`nullsec-highlighted-${systemGroups.nullsec.highlighted.length}`} ref={nullsecHighlightRef} args={[highlightGeometry, materials.highlightMaterials.nullsec, systemGroups.nullsec.highlighted.length]} />
			)}
			{Array.from(customSystemGroups.entries()).map(([key, items]) => {
				const { material, geometry } = customMaterialsAndGeometries.get(key)!;
				return (
					<instancedMesh
						key={`${key}-${items.length}`}
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
			{jumpDriveHighlight &&
				jumpDriveHighlight.systems.length > 0 &&
				jumpDriveHighlight.systems
					.filter((system) => system._key !== jumpDriveConfig?.originSystemId)
					.map((system) => (
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


