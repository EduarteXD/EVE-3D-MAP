import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SolarSystem } from '../types';
import { SYSTEM_POINT_SIZE } from './constants';

export function JumpDriveReachableRing({
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
		<mesh ref={ringRef} position={[-system.position.x, -system.position.y, system.position.z]} raycast={() => null} renderOrder={-1}>
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


