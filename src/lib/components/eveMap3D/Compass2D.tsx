import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function Compass2DInternal({ onRotationChange }: { onRotationChange?: (rotation: number) => void }) {
  const { camera } = useThree();
  const lastAngleRef = useRef(0);
  const accumulatedRotationRef = useRef(0);

  useEffect(() => {
    let frameId: number;

    const updateRotation = () => {
      // 获取相机的世界方向
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      
      // 将3D方向投影到XZ平面（水平面）
      const directionXZ = new THREE.Vector2(cameraDirection.x, cameraDirection.z);
      
      // 计算角度（弧度）
      const angle = Math.atan2(directionXZ.x, -directionXZ.y);
      
      // 计算角度差异
      let delta = angle - lastAngleRef.current;
      
      // 处理角度跳变（-π 到 π 的边界）
      if (delta > Math.PI) {
        delta -= 2 * Math.PI;
      } else if (delta < -Math.PI) {
        delta += 2 * Math.PI;
      }
      
      // 累积旋转
      accumulatedRotationRef.current += delta;
      lastAngleRef.current = angle;
      
      // 转换为度数
      const degrees = -accumulatedRotationRef.current * (180 / Math.PI);
      
      if (onRotationChange) {
        onRotationChange(degrees);
      }
      
      frameId = requestAnimationFrame(updateRotation);
    };

    updateRotation();

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [camera, onRotationChange]);

  return null;
}

export function Compass2DOverlay({ rotation, size = 80, bottom = 20, right = 20 }: { rotation: number; size?: number; bottom?: number; right?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: `${bottom}px`,
        right: `${right}px`,
        width: `${size}px`,
        height: `${size}px`,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: '70%',
          height: '70%',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '5px solid rgba(128, 128, 128, 0.3)',
          backgroundColor: 'transparent',
        }}
      />
      
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          transform: `rotate(${rotation + 180}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '12px',
            width: '0',
            height: '0',
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '6px solid #ffffff',
            transform: 'translateX(-50%)',
          }}
        />
        
        <div
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            width: '5px',
            height: '3px',
            backgroundColor: '#4a9eff',
            transform: 'translateY(-50%)',
          }}
        />
        
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '12px',
            width: '3px',
            height: '5px',
            backgroundColor: '#4a9eff',
            transform: 'translateX(-50%)',
          }}
        />
        
        <div
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            width: '5px',
            height: '3px',
            backgroundColor: '#4a9eff',
            transform: 'translateY(-50%)',
          }}
        />
      </div>
    </div>
  );
}

