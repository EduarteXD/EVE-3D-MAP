import type React from 'react';

export type Language = 'zh' | 'en';

export interface SolarSystem {
  _key: number;
  name: { [key: string]: string };
  position: { x: number; y: number; z: number };
  regionID: number;
  constellationID: number;
  securityStatus: number;
  securityClass?: string;
}

export interface Region {
  _key: number;
  name: { [key: string]: string };
  position: { x: number; y: number; z: number };
  constellationIDs: number[];
}

export interface Stargate {
  _key: number;
  solarSystemID: number;
  destination: {
    solarSystemID: number;
    stargateID: number;
  };
  position: { x: number; y: number; z: number };
  typeID: number;
}

/**
 * 玩家建造的跳桥连接信息
 */
export interface Jumpgate {
  /** 起始星系ID */
  fromSystemId: number;
  /** 目标星系ID */
  toSystemId: number;
}

/**
 * 跳跃引擎配置
 */
export interface JumpDriveConfig {
  /** 起始星系ID（优先使用，如果存在） */
  originSystemId?: number;
  /** 自定义起始位置（当找不到星系时使用） */
  originPosition?: { x: number; y: number; z: number };
  /** 跳跃距离（单位：光年） */
  rangeLightYears: number;
  /** 是否渲染可达泡泡（默认 true） */
  showBubble?: boolean;
  /** 泡泡颜色（默认 '#00ffff'） */
  bubbleColor?: string;
  /** 泡泡透明度（默认 0.12） */
  bubbleOpacity?: number;
  /** 泡泡线框透明度（默认 0.35） */
  bubbleWireframeOpacity?: number;
  /** 是否高亮可达星系（默认 true） */
  showReachableSystems?: boolean;
  /** 可达星系颜色（默认 '#00ffff'） */
  reachableSystemColor?: string;
  /** 可达星系大小倍数（默认 1.6） */
  reachableSystemSizeMultiplier?: number;
  /** 可达星系透明度（默认 1.0） */
  reachableSystemOpacity?: number;
}

/**
 * 星系渲染配置
 */
export interface SystemRenderConfig {
  /** 星系ID */
  systemId: number;
  /** 颜色 (hex格式，如 '#FF0000') */
  color?: string;
  /** 大小倍数 (默认1.0) */
  size?: number;
  /** 是否高亮 */
  highlighted?: boolean;
  /** 透明度 (0-1) */
  opacity?: number;
}

/**
 * 安全等级颜色配置
 */
export interface SecurityColorConfig {
  /** 高安颜色 (securityStatus >= 0.45) */
  highsec?: string;
  /** 低安颜色 (0.0 <= securityStatus < 0.45) */
  lowsec?: string;
  /** 00颜色 (securityStatus < 0.0) */
  nullsec?: string;
}

/**
 * 聚焦配置
 */
export interface FocusConfig {
  /** 聚焦类型：星系或星域 */
  type: 'system' | 'region';
  /** 目标ID（星系ID或星域ID） */
  targetId: number;
  /** 是否高亮 */
  highlight?: boolean;
  /** 动画时长（毫秒，默认1500） */
  animationDuration?: number;
}

/**
 * 事件回调
 */
export interface EveMap3DEvents {
  /** 点击星系时触发 */
  onSystemClick?: (system: SolarSystem) => void;
  /** 点击星域标签时触发 */
  onRegionClick?: (region: Region) => void;
  /** 聚焦完成时触发 */
  onFocusComplete?: (config: FocusConfig) => void;
}

/**
 * 自定义样式配置
 */
export interface CustomStyleConfig {
  /** 背景颜色 */
  backgroundColor?: string;
  /** 连接线颜色 */
  connectionLineColor?: string;
  /** 连接线透明度 */
  connectionLineOpacity?: number;
  /** 高亮连接线颜色 */
  highlightedConnectionLineColor?: string;
  /** 跳桥连接线颜色 */
  jumpgateLineColor?: string;
  /** 跳桥连接线透明度 */
  jumpgateLineOpacity?: number;
  /** 高亮跳桥连接线颜色 */
  highlightedJumpgateLineColor?: string;
  /** 标签字体大小 */
  labelFontSize?: number;
  /** 标签颜色 */
  labelColor?: string;
}

/**
 * 地图控制接口
 */
export interface MapControl {
  /** 重置相机到初始位置 */
  resetCamera?: () => void;
  /** 聚焦到指定系统 */
  focusSystem?: (systemId: number) => void;
  /** 聚焦到指定星域 */
  focusRegion?: (regionId: number) => void;
  /** 设置相机位置 */
  setCameraPosition?: (x: number, y: number, z: number) => void;
  /** 设置相机目标 */
  setCameraTarget?: (x: number, y: number, z: number) => void;
  /** 获取相机位置 */
  getCameraPosition?: () => { x: number; y: number; z: number } | null;
  /** 获取相机目标 */
  getCameraTarget?: () => { x: number; y: number; z: number } | null;
  /** @internal 内部方法，供组件使用 */
  __internal?: {
    setControlsRef: (ref: unknown) => void;
    setSystems: (systems: SolarSystem[]) => void;
    setInitialCameraPosition: (position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) => void;
  };
}

/**
 * EVE Map 3D 组件 Props
 */
export interface EveMap3DProps {
  /** 太阳系数据（必需） */
  systems: SolarSystem[];
  /** 星门数据（必需） */
  stargates: Stargate[];
  /** 跳桥数据（可选） */
  jumpgates?: Jumpgate[];
  /** 星域数据（可选，用于显示星域标签） */
  regions?: Region[];
  /** 语言设置 (默认 'zh') */
  language?: Language;
  /** 星系渲染配置数组（可选，不传入则按安全等级渲染） */
  systemRenderConfigs?: SystemRenderConfig[];
  /** 安全等级颜色配置（可选，用于覆盖默认颜色） */
  securityColors?: SecurityColorConfig;
  /** 聚焦配置（可选） */
  focus?: FocusConfig;
  /** 事件回调 */
  events?: EveMap3DEvents;
  /** 自定义样式 */
  style?: CustomStyleConfig;
  /** 是否只显示New Eden星系（默认 true） */
  filterNewEdenOnly?: boolean;
  /** 高亮的星域ID（外部控制） */
  highlightedRegionId?: number | null;
  /** 自定义过滤函数 */
  systemFilter?: (system: SolarSystem) => boolean;
  /** 容器样式 */
  containerStyle?: React.CSSProperties;
  /** 容器类名 */
  containerClassName?: string;
  /** 地图控制对象（通过 useMapControl 生成） */
  mapControl?: MapControl;
  /** 跳跃引擎配置 */
  jumpDriveConfig?: JumpDriveConfig;
}

