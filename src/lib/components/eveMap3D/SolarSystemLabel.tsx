import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Language, SolarSystem } from '../../types';

export function SolarSystemLabel({
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
	const grayFontSize = baseFontSize * 0.7;
	const labelOffset = pointSize * 3;
	const maxGrayLabelDistance = 5e16;

	useFrame(() => {
		if (textRef.current) {
			const systemPosition = new THREE.Vector3(-system.position.x, -system.position.y, system.position.z);
			const distanceToCamera = camera.position.distanceTo(systemPosition);
			if (isHighlightedRegion && distanceToCamera > maxGrayLabelDistance) {
				textRef.current.visible = false;
				return;
			}
			textRef.current.visible = true;
			const toCamera = new THREE.Vector3().subVectors(camera.position, systemPosition);
			const cameraDirection = toCamera.clone().normalize();
			const up = new THREE.Vector3(0, 1, 0);
			const rightDirection = new THREE.Vector3();
			rightDirection.crossVectors(up, cameraDirection).normalize();
			const labelPosition = new THREE.Vector3().copy(systemPosition).add(rightDirection.clone().multiplyScalar(labelOffset));
			positionRef.current.copy(labelPosition);
			textRef.current.position.copy(labelPosition);
			
			// 使标签完全面向摄像机，平行于屏幕
			textRef.current.quaternion.copy(camera.quaternion);
			
			const scale = distanceToCamera / 3e16;
			textRef.current.scale.setScalar(scale);
		}
	});

	const systemName = language === 'zh' ? system.name.zh || system.name.en : system.name.en || system.name.zh;
	const labelColor = isHighlightedRegion ? '#888888' : style?.labelColor || 'white';
	const fontSize = isHighlightedRegion ? grayFontSize : baseFontSize;

	return (
		<Text
			ref={textRef}
			position={[-system.position.x + labelOffset, -system.position.y, system.position.z]}
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


