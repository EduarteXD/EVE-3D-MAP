import * as THREE from 'three';

/**
 * 投影标签的基础接口
 * 包含用于重叠检测所需的所有属性
 */
export interface ProjectedLabel {
	/** 标签的唯一标识符 */
	id: number;
	/** 投影到屏幕空间的位置 */
	screenPos: THREE.Vector3;
	/** 距相机的距离 */
	dist: number;
	/** 标签在屏幕空间中的宽度 */
	screenWidth: number;
	/** 标签在屏幕空间中的高度 */
	screenHeight: number;
}

/**
 * 空间哈希网格，用于加速标签重叠检测
 * 将屏幕空间划分为网格，每个网格存储该区域的标签
 */
class SpatialHashGrid {
	private cellSize: number;
	private grid: Map<string, Set<number>>;

	constructor(cellSize: number = 0.1) {
		this.cellSize = cellSize;
		this.grid = new Map();
	}

	/**
	 * 获取标签占据的所有网格单元
	 */
	private getOccupiedCells(label: ProjectedLabel): string[] {
		const cells: string[] = [];
		const halfWidth = label.screenWidth / 2;
		const halfHeight = label.screenHeight / 2;
		
		const minX = label.screenPos.x - halfWidth;
		const maxX = label.screenPos.x + halfWidth;
		const minY = label.screenPos.y - halfHeight;
		const maxY = label.screenPos.y + halfHeight;

		const minCellX = Math.floor(minX / this.cellSize);
		const maxCellX = Math.floor(maxX / this.cellSize);
		const minCellY = Math.floor(minY / this.cellSize);
		const maxCellY = Math.floor(maxY / this.cellSize);

		for (let x = minCellX; x <= maxCellX; x++) {
			for (let y = minCellY; y <= maxCellY; y++) {
				cells.push(`${x},${y}`);
			}
		}

		return cells;
	}

	/**
	 * 添加标签到网格
	 */
	add(label: ProjectedLabel): void {
		const cells = this.getOccupiedCells(label);
		for (const cell of cells) {
			if (!this.grid.has(cell)) {
				this.grid.set(cell, new Set());
			}
			this.grid.get(cell)!.add(label.id);
		}
	}

	/**
	 * 获取可能与指定标签重叠的标签ID
	 */
	getPotentialCollisions(label: ProjectedLabel): Set<number> {
		const potentialCollisions = new Set<number>();
		const cells = this.getOccupiedCells(label);
		
		for (const cell of cells) {
			const labelsInCell = this.grid.get(cell);
			if (labelsInCell) {
				for (const id of labelsInCell) {
					potentialCollisions.add(id);
				}
			}
		}

		return potentialCollisions;
	}

	/**
	 * 清空网格
	 */
	clear(): void {
		this.grid.clear();
	}
}

/**
 * 检测两个标签是否在屏幕空间中重叠
 * 使用矩形边界框（AABB）进行碰撞检测
 * 
 * @param a 第一个标签
 * @param b 第二个标签
 * @returns 如果两个标签重叠返回 true，否则返回 false
 */
function checkLabelOverlap(a: ProjectedLabel, b: ProjectedLabel): boolean {
	// 计算两个标签中心点的距离
	const dx = Math.abs(a.screenPos.x - b.screenPos.x);
	const dy = Math.abs(a.screenPos.y - b.screenPos.y);
	
	// 计算最小不重叠距离（两个标签的半宽/半高之和）
	const minDistX = (a.screenWidth + b.screenWidth) / 2;
	const minDistY = (a.screenHeight + b.screenHeight) / 2;
	
	// 如果在 X 和 Y 方向上的距离都小于最小距离，则重叠
	return dx < minDistX && dy < minDistY;
}

/**
 * 从一组投影标签中检测可见的标签（无重叠）
 * 使用空间哈希网格优化，将时间复杂度从 O(n²) 降低到接近 O(n)
 * 
 * @param labels 要检测的标签数组
 * @param sortFn 排序函数，用于确定标签的优先级（返回负数表示 a 优先于 b）
 * @returns 可见标签的 ID 集合
 * 
 * @example
 * ```typescript
 * // 按距离排序，优先显示近处的标签
 * const visible = detectLabelVisibility(labels, (a, b) => a.dist - b.dist);
 * 
 * // 自定义优先级：高亮标签优先，然后按距离
 * const visible = detectLabelVisibility(labels, (a, b) => {
 *   if (a.isHighlighted !== b.isHighlighted) {
 *     return a.isHighlighted ? -1 : 1;
 *   }
 *   return a.dist - b.dist;
 * });
 * ```
 */
export function detectLabelVisibility<T extends ProjectedLabel>(
	labels: T[],
	sortFn: (a: T, b: T) => number
): Set<number> {
	if (labels.length === 0) return new Set();

	// 按优先级排序标签
	const sortedLabels = [...labels];
	sortedLabels.sort(sortFn);

	// 创建标签映射和空间哈希网格
	const labelMap = new Map(sortedLabels.map(label => [label.id, label]));
	const spatialGrid = new SpatialHashGrid(0.15); // 网格大小调优，0.15 在屏幕空间中是一个合理的值
	const visible = new Set<number>();

	for (const label of sortedLabels) {
		// 使用空间哈希获取潜在的碰撞标签（仅检查附近的标签）
		const potentialCollisions = spatialGrid.getPotentialCollisions(label);
		let hasOverlap = false;
		
		// 只检查空间上接近的可见标签
		for (const visibleId of potentialCollisions) {
			if (!visible.has(visibleId)) continue;
			
			const visibleLabel = labelMap.get(visibleId)!;
			if (checkLabelOverlap(label, visibleLabel)) {
				hasOverlap = true;
				break;
			}
		}
		
		if (!hasOverlap) {
			visible.add(label.id);
			spatialGrid.add(label); // 将可见标签添加到空间哈希网格
		}
	}

	return visible;
}

