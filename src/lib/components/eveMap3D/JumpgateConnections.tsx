import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SolarSystem } from '../../types';

export function JumpgateConnections({
	connections,
	highlightedRegionId,
	highlightedSystemIds,
	style,
}: {
	connections: Array<{ from: SolarSystem; to: SolarSystem }>;
	highlightedRegionId: number | null;
	highlightedSystemIds: Set<number>;
	style?: {
		jumpgateLineColor?: string;
		jumpgateLineOpacity?: number;
		highlightedJumpgateLineColor?: string;
		jumpgateCurveHeightScale?: number;
	};
}) {
	const curveSegments = 48;

	const materialSettings = useMemo(
		() => ({
			normalColor: style?.jumpgateLineColor || '#00ff00',
			normalOpacity: style?.jumpgateLineOpacity !== undefined ? style.jumpgateLineOpacity : 0.85,
			highlightedColor: style?.highlightedJumpgateLineColor || '#00ff00',
			curveHeightScale: style?.jumpgateCurveHeightScale ?? 0.2,
		}),
		[style],
	);

	const normalMaterial = useMemo(
		() =>
			new THREE.LineBasicMaterial({
				color: materialSettings.normalColor,
				transparent: materialSettings.normalOpacity < 1,
				opacity: materialSettings.normalOpacity,
			}),
		[materialSettings],
	);

	const highlightedMaterial = useMemo(
		() =>
			new THREE.LineBasicMaterial({
				color: materialSettings.highlightedColor,
				transparent: false,
				opacity: 1.0,
			}),
		[materialSettings],
	);

	const { curveHeightScale } = materialSettings;

	const curves = useMemo(() => {
		const results: Array<{
			key: string;
			geometry: THREE.BufferGeometry;
			highlighted: boolean;
		}> = [];

		connections.forEach((conn) => {
			const fromPosition = new THREE.Vector3(conn.from.position.x, conn.from.position.y, conn.from.position.z);
			const toPosition = new THREE.Vector3(conn.to.position.x, conn.to.position.y, conn.to.position.z);

			const forwardVector = toPosition.clone().sub(fromPosition);
			const distance = forwardVector.length();

			const forwardDirection = distance > 0 ? forwardVector.clone().normalize() : new THREE.Vector3(1, 0, 0);
			const globalUp = new THREE.Vector3(0, 1, 0);

			let planeNormal = forwardDirection.clone().cross(globalUp);
			if (planeNormal.lengthSq() === 0) {
				planeNormal = forwardDirection.clone().cross(new THREE.Vector3(1, 0, 0));
			}
			planeNormal.normalize();

			const curveUp = planeNormal.clone().cross(forwardDirection).normalize();
			const curveHeight = distance > 0 ? Math.max(distance * curveHeightScale, 1e15) : 1e15;
			const positions = new Float32Array((curveSegments + 1) * 3);

			for (let segment = 0; segment <= curveSegments; segment += 1) {
				const t = segment / curveSegments;
				const basePoint = fromPosition.clone().addScaledVector(forwardDirection, distance * t);
				const offset = Math.sin(Math.PI * t) * curveHeight;
				basePoint.addScaledVector(curveUp, offset);

				const index = segment * 3;
				positions[index] = basePoint.x;
				positions[index + 1] = basePoint.y;
				positions[index + 2] = basePoint.z;
			}

			const segmentPositions = new Float32Array(curveSegments * 2 * 3);
			for (let segment = 0; segment < curveSegments; segment += 1) {
				const startIndex = segment * 3;
				const endIndex = (segment + 1) * 3;
				const destIndex = segment * 6;

				segmentPositions[destIndex] = positions[startIndex];
				segmentPositions[destIndex + 1] = positions[startIndex + 1];
				segmentPositions[destIndex + 2] = positions[startIndex + 2];
				segmentPositions[destIndex + 3] = positions[endIndex];
				segmentPositions[destIndex + 4] = positions[endIndex + 1];
				segmentPositions[destIndex + 5] = positions[endIndex + 2];
			}

			const isHighlighted =
				(highlightedRegionId !== null && conn.from.regionID === highlightedRegionId && conn.to.regionID === highlightedRegionId) ||
				highlightedSystemIds.has(conn.from._key) ||
				highlightedSystemIds.has(conn.to._key);

			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.BufferAttribute(segmentPositions, 3));

			results.push({
				key: `${conn.from._key}-${conn.to._key}`,
				geometry,
				highlighted: isHighlighted,
			});
		});

		return results;
	}, [connections, curveHeightScale, highlightedRegionId, highlightedSystemIds]);

	useEffect(() => {
		return () => {
			curves.forEach((curve) => {
				curve.geometry.dispose();
			});
		};
	}, [curves]);

	return (
		<>
			{curves.map((curve) => (
				<lineSegments key={curve.key} geometry={curve.geometry} material={curve.highlighted ? highlightedMaterial : normalMaterial} />
			))}
		</>
	);
}


