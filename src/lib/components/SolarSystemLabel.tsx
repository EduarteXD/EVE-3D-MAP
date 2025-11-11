import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Language, SolarSystem } from '../types';

// 根据安全等级获取颜色
function getSecurityColor(securityStatus: number): string {
	if (securityStatus >= 0.5) {
		// 高安：0.5-1.0，渐变从浅绿到青色
		const t = (securityStatus - 0.5) / 0.5;
		return `hsl(${150 + t * 30}, 80%, ${55 + t * 10}%)`;
	} else if (securityStatus > 0.0) {
		// 低安：0.1-0.4，渐变从橙色到黄色
		const t = securityStatus / 0.5;
		return `hsl(${30 + t * 30}, 90%, ${50 + t * 10}%)`;
	} else {
		// 零安/负安：≤0.0，红色
		return '#ff4444';
	}
}

export function SolarSystemLabel({
	system,
	language,
	style,
	isHighlightedRegion = false,
	visible = true,
}: {
	system: SolarSystem;
	language: Language;
	style?: { labelFontSize?: number; labelColor?: string };
	isHighlightedRegion?: boolean;
	visible?: boolean;
}) {
	const groupRef = useRef<THREE.Group>(null);
	const nameTextRef = useRef<THREE.Mesh>(null);
	const secTextRef = useRef<THREE.Mesh>(null);
	const { camera } = useThree();
	const pointSize = 1e15;
	const baseFontSize = style?.labelFontSize || 1e15;
	const grayFontSize = baseFontSize * 0.7;
	const labelOffset = pointSize * 3 * (isHighlightedRegion ? 0.6 : 1.1);
	const maxGrayLabelDistance = 4e17;

	useFrame(() => {
		if (groupRef.current && nameTextRef.current && secTextRef.current) {
			const systemPosition = new THREE.Vector3(-system.position.x, -system.position.y, system.position.z);
			const distanceToCamera = camera.position.distanceTo(systemPosition);
			if (isHighlightedRegion && distanceToCamera > maxGrayLabelDistance) {
				groupRef.current.visible = false;
				return;
			}
			
			// 根据遮挡检测结果控制可见性
			groupRef.current.visible = true;
			
			// 设置透明度：被遮挡的标签降低透明度
			const targetOpacity = visible ? 1.0 : 0.3;
			const setOpacity = (mat: THREE.Material) => {
				if (mat.transparent !== true) {
					mat.transparent = true;
				}
				mat.opacity = targetOpacity;
			};
			if (Array.isArray(nameTextRef.current.material)) {
				nameTextRef.current.material.forEach(setOpacity);
			} else if (nameTextRef.current.material) {
				setOpacity(nameTextRef.current.material);
			}
			if (Array.isArray(secTextRef.current.material)) {
				secTextRef.current.material.forEach(setOpacity);
			} else if (secTextRef.current.material) {
				setOpacity(secTextRef.current.material);
			}
			const toCamera = new THREE.Vector3().subVectors(camera.position, systemPosition);
			const cameraDirection = toCamera.clone().normalize();
			const up = new THREE.Vector3(0, 1, 0);
			const rightDirection = new THREE.Vector3();
			rightDirection.crossVectors(up, cameraDirection).normalize();
			const labelPosition = new THREE.Vector3().copy(systemPosition).add(rightDirection.clone().multiplyScalar(labelOffset));
			
			groupRef.current.position.copy(labelPosition);
			
			// 使标签完全面向摄像机，平行于屏幕
			groupRef.current.quaternion.copy(camera.quaternion);
			
			const scale = distanceToCamera / 5e16 * (isHighlightedRegion ? 0.9 : 1.3);
			groupRef.current.scale.setScalar(scale);
			
			// 动态调整安全等级文字的位置，使其紧跟名称
			if (nameTextRef.current.geometry?.boundingBox) {
				const bbox = nameTextRef.current.geometry.boundingBox;
				const nameWidth = (bbox.max.x - bbox.min.x);
				secTextRef.current.position.x = nameWidth;
			}
		}
	});

	const systemName = language === 'zh' ? system.name.zh || system.name.en : system.name.en || system.name.zh;
	const nameColor = isHighlightedRegion ? '#999' : style?.labelColor || 'white';
	const securityColor = getSecurityColor(system.securityStatus);
	const fontSize = isHighlightedRegion ? grayFontSize : baseFontSize;
	
	// 格式化安全等级显示
	const securityStatus = system.securityStatus.toFixed(1);
	const nameText = `${systemName || String(system._key)} `;
	const secText = ` ${securityStatus}`;

	return (
		<group ref={groupRef}>
			<Text
				ref={nameTextRef}
				position={[0, 0, 0]}
				fontSize={fontSize}
				color={nameColor}
				anchorX="left"
				anchorY="middle"
				outlineWidth={0.05}
				outlineColor="#000"
			>
				{nameText}
			</Text>
			<Text
				ref={secTextRef}
				position={[0, 0, 0]}
				fontSize={fontSize}
				color={securityColor}
				anchorX="left"
				anchorY="middle"
				outlineWidth={0.05}
				outlineColor="#000"
			>
				{secText}
			</Text>
		</group>
	);
}


