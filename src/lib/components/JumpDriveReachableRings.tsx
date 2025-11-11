import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SolarSystem } from '../types';
import { SYSTEM_POINT_SIZE } from './constants';

/**
 * 优化版本：使用 InstancedMesh 批量渲染所有可达星系的环
 * 这样可以显著提升性能，特别是当跳跃距离较大时
 */
export function JumpDriveReachableRings({
	systems,
	color,
	opacity,
	scale,
}: {
	systems: SolarSystem[];
	color: string;
	opacity: number;
	scale: number;
}) {
	const meshRef = useRef<THREE.InstancedMesh>(null);
	const { camera } = useThree();
	
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const baseRadius = SYSTEM_POINT_SIZE * 1.2 * safeScale;
	const ringThickness = baseRadius * 0.05;

	// 创建共享的几何体和材质
	const geometry = useMemo(
		() => new THREE.RingGeometry(Math.max(baseRadius - ringThickness, 0), baseRadius, 64),
		[baseRadius, ringThickness],
	);

	const material = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity,
				side: THREE.DoubleSide,
				depthWrite: false,
				depthTest: false,
				blending: THREE.AdditiveBlending,
			}),
		[color, opacity],
	);

	// 初始化实例位置
	useEffect(() => {
		if (!meshRef.current) return;

		const matrix = new THREE.Matrix4();
		systems.forEach((system, index) => {
			matrix.setPosition(-system.position.x, -system.position.y, system.position.z);
			meshRef.current!.setMatrixAt(index, matrix);
		});
		meshRef.current.instanceMatrix.needsUpdate = true;
	}, [systems]);

	// 每帧更新所有实例的朝向，使其面向相机
	useFrame(() => {
		if (!meshRef.current) return;

		const matrix = new THREE.Matrix4();
		const quaternion = new THREE.Quaternion();
		const position = new THREE.Vector3();
		const scale = new THREE.Vector3(1, 1, 1);

		systems.forEach((system, index) => {
			// 获取环的位置
			position.set(-system.position.x, -system.position.y, system.position.z);

			// 计算朝向相机的旋转
			const direction = new THREE.Vector3();
			direction.subVectors(camera.position, position).normalize();

			// 创建旋转矩阵使环面向相机
			const up = new THREE.Vector3(0, 1, 0);
			if (Math.abs(direction.dot(up)) > 0.999) {
				up.set(0, 0, 1);
			}
			const lookAtMatrix = new THREE.Matrix4();
			lookAtMatrix.lookAt(position, camera.position, up);
			quaternion.setFromRotationMatrix(lookAtMatrix);

			// 组合变换矩阵
			matrix.compose(position, quaternion, scale);
			meshRef.current!.setMatrixAt(index, matrix);
		});

		meshRef.current.instanceMatrix.needsUpdate = true;
	});

	if (systems.length === 0) return null;

	return (
		<instancedMesh
			ref={meshRef}
			args={[geometry, material, systems.length]}
			frustumCulled={false}
			renderOrder={-1}
		/>
	);
}

