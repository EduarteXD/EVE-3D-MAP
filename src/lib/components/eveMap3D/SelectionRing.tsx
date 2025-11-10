import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SolarSystem } from '../../types';

export function SelectionRing({ system }: { system: SolarSystem }) {
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
		<mesh ref={ringRef} position={[-system.position.x, -system.position.y, system.position.z]}>
			<ringGeometry args={[ringRadius, ringRadius + ringThickness, 64]} />
			<meshBasicMaterial color="white" side={THREE.DoubleSide} transparent opacity={0.9} />
		</mesh>
	);
}


