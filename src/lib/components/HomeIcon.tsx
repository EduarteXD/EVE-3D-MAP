import { useState } from 'react';
import { Html } from '@react-three/drei';
import { Home } from 'lucide-react';
import type { SolarSystem } from '../types';

export function HomeIcon({ 
	system, 
	onSystemClick 
}: { 
	system: SolarSystem;
	onSystemClick: (system: SolarSystem) => void;
}) {
	const [isHovered, setIsHovered] = useState(false);
	const pointSize = 1e15;
	const offsetY = pointSize * 6;

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onSystemClick(system);
	};

	return (
		<Html
			position={[-system.position.x, -system.position.y + offsetY, system.position.z]}
			center
			distanceFactor={pointSize * 100}
      // sprite
			zIndexRange={[100, 0]}
		>
			<div
				onClick={handleClick}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: isHovered ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)',
					borderRadius: '50%',
					padding: '8px',
					backdropFilter: 'blur(4px)',
					border: `2px solid rgba(255, 255, 255, ${isHovered ? 1.0 : 0.8})`,
					boxShadow: isHovered ? '0 0 30px rgba(255, 255, 255, 0.9)' : '0 0 20px rgba(255, 255, 255, 0.6)',
					cursor: 'pointer',
					transition: 'all 0.2s ease-in-out',
					transform: isHovered ? 'scale(1.1)' : 'scale(1)',
				}}
			>
				<Home
					size={32}
					color="#FFFFFF"
					strokeWidth={2.5}
					fill={isHovered ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)'}
				/>
			</div>
		</Html>
	);
}

