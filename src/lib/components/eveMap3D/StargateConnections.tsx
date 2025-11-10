import { useMemo } from 'react';
import * as THREE from 'three';
import type { SolarSystem } from '../../types';

export function StargateConnections({
	connections,
	highlightedRegionId,
	highlightedSystemIds,
	style,
}: {
	connections: Array<{ from: SolarSystem; to: SolarSystem }>;
	highlightedRegionId: number | null;
	highlightedSystemIds: Set<number>;
	style?: { connectionLineColor?: string; connectionLineOpacity?: number; highlightedConnectionLineColor?: string };
}) {
	const { normalConnections, highlightedConnections } = useMemo(() => {
		const normal: Array<{ from: SolarSystem; to: SolarSystem }> = [];
		const highlighted: Array<{ from: SolarSystem; to: SolarSystem }> = [];

		connections.forEach((conn) => {
			const isHighlighted =
				(highlightedRegionId !== null && conn.from.regionID === highlightedRegionId && conn.to.regionID === highlightedRegionId) ||
				highlightedSystemIds.has(conn.from._key) ||
				highlightedSystemIds.has(conn.to._key);

			if (isHighlighted) {
				highlighted.push(conn);
			} else {
				normal.push(conn);
			}
		});

		return { normalConnections: normal, highlightedConnections: highlighted };
	}, [connections, highlightedRegionId, highlightedSystemIds]);

	const normalLineGeometry = useMemo(() => {
		const geometry = new THREE.BufferGeometry();
		const positions: number[] = [];

		normalConnections.forEach((conn) => {
			positions.push(
				-conn.from.position.x,
				-conn.from.position.y,
				conn.from.position.z,
				-conn.to.position.x,
				-conn.to.position.y,
				conn.to.position.z,
			);
		});

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		return geometry;
	}, [normalConnections]);

	const highlightedLineGeometry = useMemo(() => {
		const geometry = new THREE.BufferGeometry();
		const positions: number[] = [];

		highlightedConnections.forEach((conn) => {
			positions.push(
				-conn.from.position.x,
				-conn.from.position.y,
				conn.from.position.z,
				-conn.to.position.x,
				-conn.to.position.y,
				conn.to.position.z,
			);
		});

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		return geometry;
	}, [highlightedConnections]);

	const normalMaterial = useMemo(
		() =>
			new THREE.LineBasicMaterial({
				color: style?.connectionLineColor || '#4488ff',
				transparent: true,
				opacity: style?.connectionLineOpacity !== undefined ? style.connectionLineOpacity : 0.2,
			}),
		[style],
	);

	const highlightedMaterial = useMemo(
		() =>
			new THREE.LineBasicMaterial({
				color: style?.highlightedConnectionLineColor || '#00ffff',
				transparent: false,
				opacity: 0.8,
			}),
		[style],
	);

	return (
		<>
			{normalConnections.length > 0 && <lineSegments geometry={normalLineGeometry} material={normalMaterial} />}
			{highlightedConnections.length > 0 && <lineSegments geometry={highlightedLineGeometry} material={highlightedMaterial} />}
		</>
	);
}


