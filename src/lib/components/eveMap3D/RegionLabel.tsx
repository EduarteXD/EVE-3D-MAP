import { useCallback, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Language, Region, SolarSystem } from '../../types';

export function RegionLabel({
	region,
	systems,
	language,
	visible,
	style,
	isHighlighted = false,
	onClick,
}: {
	region: Region;
	systems: SolarSystem[];
	language: Language;
	visible: boolean;
	style?: { labelFontSize?: number; labelColor?: string };
	isHighlighted?: boolean;
	onClick?: (region: Region) => void;
}) {
	const textRef = useRef<THREE.Mesh>(null);
	const opacitySetRef = useRef(false);
	const { camera } = useThree();
	const baseFontSize = (style?.labelFontSize || 2e15) * 1.5;
	const labelOffset = 5e15;

	const regionCenter = useMemo(() => {
		const regionSystems = systems.filter((s) => s.regionID === region._key);
		if (regionSystems.length === 0) {
			return new THREE.Vector3(-region.position.x, -region.position.y, region.position.z);
		}
		const center = new THREE.Vector3(0, 0, 0);
		regionSystems.forEach((system) => {
			center.add(new THREE.Vector3(-system.position.x, -system.position.y, system.position.z));
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
			setMaterialOpacity();
			const distanceToCamera = camera.position.distanceTo(regionCenter);
			textRef.current.visible = true;
			const toCamera = new THREE.Vector3().subVectors(camera.position, regionCenter);
			const cameraDirection = toCamera.clone().normalize();
			const up = new THREE.Vector3(0, 20, 0);
			const rightDirection = new THREE.Vector3();
			rightDirection.crossVectors(up, cameraDirection).normalize();
			const labelPosition = new THREE.Vector3().copy(regionCenter).add(rightDirection.clone().multiplyScalar(labelOffset)).add(up.clone().multiplyScalar(labelOffset * 0.5));
			textRef.current.position.copy(labelPosition);
			
			// 使标签完全面向摄像机，平行于屏幕
			textRef.current.quaternion.copy(camera.quaternion);
			
			const scale = distanceToCamera / (isHighlighted ? 1e17 : 2e17);
			textRef.current.scale.setScalar(scale);
		}
	});

	const regionName = language === 'zh' ? region.name.zh || region.name.en : region.name.en || region.name.zh;
	const labelColor = isHighlighted ? (style?.labelColor || '#ffff00') : '#ffffff';

	const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		if (onClick) {
			onClick(region);
		}
	}, [onClick, region]);

	return (
		<Text
			ref={textRef}
			fillOpacity={visible ? 1 : 0.4}
			position={[regionCenter.x, regionCenter.y, regionCenter.z]}
			fontSize={baseFontSize}
			color={labelColor}
			anchorX="center"
			anchorY="middle"
			outlineWidth={0.1}
			outlineColor="#000"
			onClick={handleClick}
			onPointerOver={() => {
				if (textRef.current) {
					document.body.style.cursor = 'pointer';
				}
			}}
			onPointerOut={() => {
				document.body.style.cursor = 'auto';
			}}
		>
			{regionName || `Region ${region._key}`}
		</Text>
	);
}


