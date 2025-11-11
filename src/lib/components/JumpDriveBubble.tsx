import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function JumpDriveBubble({
	origin,
	radius,
	color,
	opacity,
}: {
	origin: THREE.Vector3;
	radius: number;
	color: string;
	opacity: number;
	wireframeOpacity?: never;
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


