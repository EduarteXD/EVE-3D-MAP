# EVE 3D Map

一个基于 React 和 Three.js 的 EVE Online 3D 星图可视化组件库。

<img width="2550" height="1341" alt="image" src="https://github.com/user-attachments/assets/261abd34-02fe-4462-8ff5-f19b260e8d6a" />

## 特性

- 3D 可视化 EVE Online 星图
- 交互式操作（旋转、平移、缩放）
- 星系点击和高亮
- 星域高亮显示
- 自定义颜色和样式
- 多语言支持（中文/英文）

## 安装

```bash
npm install eve-map-3d
```

## 依赖要求

该库需要以下 peer dependencies：

- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `@react-three/fiber` >= 9.0.0
- `@react-three/drei` >= 10.0.0
- `three` >= 0.180.0

确保在项目中安装这些依赖：

```bash
npm install react react-dom @react-three/fiber @react-three/drei three
```

## 快速开始

### 1. 准备数据

首先需要准备 EVE Online 的星图数据。数据格式应为 JSONL（每行一个 JSON 对象）。

**必需的数据文件：**

- `mapSolarSystems.jsonl` - 太阳系数据
- `mapStargates.jsonl` - 星门连接数据
- `mapRegions.jsonl` - 星域数据（可选）

**数据格式示例：**

你可以在sde中找到这几个文件，你可以处理只保留需要的数据

```json
{"_key":30000001,"name":{"zh":"Tanoo","en":"Tanoo"},"position":{"x":161891117336.0,"y":212888732625.0,"z":-73178333011.0},"regionID":10000001,"constellationID":20000001,"securityStatus":0.8583240509033203}

{"_key":50000001,"solarSystemID":30000001,"destination":{"solarSystemID":30000002,"stargateID":50000002},"position":{"x":161891117336.0,"y":212888732625.0,"z":-73178333011.0},"typeID":29624}

{"_key":10000001,"name":{"zh":"Derelik","en":"Derelik"},"position":{"x":0.0,"y":0.0,"z":0.0},"constellationIDs":[20000001,20000002]}
```

### 2. 加载数据

创建数据加载函数：

```typescript
// utils/loadEveData.ts
import type { SolarSystem, Stargate, Region } from 'eve-map-3d';

async function parseJSONL<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.trim().split('\n');
  return lines.map(line => JSON.parse(line) as T);
}

const DATA_DIR = '/data'; // 根据你的项目结构调整

export async function loadSolarSystems(): Promise<SolarSystem[]> {
  return parseJSONL<SolarSystem>(`${DATA_DIR}/mapSolarSystems.jsonl`);
}

export async function loadStargates(): Promise<Stargate[]> {
  return parseJSONL<Stargate>(`${DATA_DIR}/mapStargates.jsonl`);
}

export async function loadRegions(): Promise<Region[]> {
  return parseJSONL<Region>(`${DATA_DIR}/mapRegions.jsonl`);
}
```

### 3. 基本使用

```tsx
import { useState, useEffect } from 'react';
import { EveMap3D, useMapControl } from 'eve-map-3d';
import type { SolarSystem, Stargate, Region } from 'eve-map-3d';
import { loadSolarSystems, loadStargates, loadRegions } from './utils/loadEveData';

function App() {
  const [systems, setSystems] = useState<SolarSystem[]>([]);
  const [stargates, setStargates] = useState<Stargate[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 创建 mapControl，配置动态选项
  const mapControl = useMapControl({
    language: 'zh',
    events: {
      onSystemClick: (system) => {
        console.log('点击了星系:', system);
      },
    },
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [systemsData, stargatesData, regionsData] = await Promise.all([
          loadSolarSystems(),
          loadStargates(),
          loadRegions(),
        ]);
        
        setSystems(systemsData);
        setStargates(stargatesData);
        setRegions(regionsData);
        
        setLoading(false);
      } catch (error) {
        console.error('加载数据失败:', error);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <EveMap3D 
        systems={systems}
        stargates={stargates}
        regions={regions}
        mapControl={mapControl} 
      />
    </div>
  );
}

export default App;
```

## API 文档

### 组件 Props

#### `EveMap3D`

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `systems` | `SolarSystem[]` | ✅ | 太阳系数据数组（静态数据） |
| `stargates` | `Stargate[]` | ✅ | 星门连接数据数组（静态数据） |
| `jumpgates` | `Jumpgate[]` | ❌ | 跳桥连接数据数组（可选） |
| `regions` | `Region[]` | ❌ | 星域数据数组（可选） |
| `mapControl` | `MapControl` | ✅ | 地图控制对象（通过 `useMapControl` 生成，管理动态配置） |

### Hook

#### `useMapControl(initialConfig?: Partial<MapControlConfig>)`

返回一个 `MapControl` 对象，用于配置和控制地图。

**参数：**

- `initialConfig`: 初始配置（可选）

**返回：**`MapControl` 对象

**配置方法：**

```tsx
const mapControl = useMapControl({
  language: 'zh',
  filterNewEdenOnly: true,
  events: {
    onSystemClick: (system) => console.log('点击星系:', system),
    onRegionClick: (region) => console.log('点击星域:', region),
  },
  style: {
    backgroundColor: '#000000',
    connectionLineColor: '#ffffff',
  },
  jumpDriveConfig: {
    originSystemId: 30000142,
    rangeLightYears: 5.0,
  },
});

// 动态更新配置
mapControl.setConfig({
  language: 'en',
  filterNewEdenOnly: false,
});

// 获取当前配置
const currentConfig = mapControl.getConfig();
```

**相机控制方法：**

```tsx
// 重置相机到初始位置
mapControl.resetCamera();

// 聚焦到指定星系（会自动移动摄像机）
mapControl.focusSystem(30000001);
mapControl.focusSystem(30000001, 2000); // 指定动画时长

// 聚焦到指定星域（会自动移动摄像机）
mapControl.focusRegion(10000001);
mapControl.focusRegion(10000001, 1500); // 指定动画时长

// 设置相机位置
mapControl.setCameraPosition(0, 0, 1e17);

// 设置相机目标
mapControl.setCameraTarget(0, 0, 0);

// 获取相机位置
const position = mapControl.getCameraPosition();

// 获取相机目标
const target = mapControl.getCameraTarget();
```

**状态控制方法：**

```tsx
// 选择星系（会自动聚焦和高亮，并移动摄像机）
mapControl.selectSystem(30000001);
mapControl.selectSystem(null); // 取消选择

// 获取当前选中的星系ID
const selectedId = mapControl.getSelectedSystemId();

// 高亮星域（会自动移动摄像机）
mapControl.highlightRegion(10000001);
mapControl.highlightRegion(null); // 取消高亮

// 获取当前高亮的星域ID
const highlightedRegionId = mapControl.getHighlightedRegionId();

// 高亮星系（不会自动移动摄像机）
mapControl.highlightSystems([30000001, 30000002]);

// 获取当前高亮的星系ID列表
const highlightedSystemIds = mapControl.getHighlightedSystemIds();
```

### 配置接口

#### `MapControlConfig`

动态配置都通过 `MapControl` 的 `setConfig` 方法设置：

```typescript
interface MapControlConfig {
  // 显示设置
  language?: 'zh' | 'en';              // 语言设置（默认 'zh'）
  filterNewEdenOnly?: boolean = true;         // 是否只显示 New Eden 星系
  systemFilter?: (system: SolarSystem) => boolean; // 自定义过滤函数
  
  // 样式配置
  systemRenderConfigs?: SystemRenderConfig[];   // 星系渲染配置
  securityColors?: SecurityColorConfig;          // 安全等级颜色配置
  style?: CustomStyleConfig;                     // 自定义样式
  
  // 容器样式
  containerStyle?: React.CSSProperties;  // 容器样式
  containerClassName?: string;           // 容器类名
  
  // 跳跃引擎配置
  jumpDriveConfig?: JumpDriveConfig;     // 跳跃引擎配置
  
  // 事件回调
  events?: {
    onSystemClick?: (system: SolarSystem) => void;
    onRegionClick?: (region: Region) => void;
  };
}
```

### 类型定义

#### `SolarSystem`

```typescript
interface SolarSystem {
  _key: number;                    // 星系ID
  name: { [key: string]: string }; // 多语言名称 {zh: "中文名", en: "English Name"}
  position: { x: number; y: number; z: number }; // 3D坐标
  regionID: number;                // 所属星域ID
  constellationID: number;          // 所属星座ID
  securityStatus: number;           // 安全等级 (-1.0 到 1.0)
  securityClass?: string;           // 安全等级分类
}
```

#### `Stargate`

```typescript
interface Stargate {
  _key: number;                     // 星门ID
  solarSystemID: number;            // 源星系ID
  destination: {
    solarSystemID: number;          // 目标星系ID
    stargateID: number;             // 目标星门ID
  };
  position: { x: number; y: number; z: number }; // 星门位置
  typeID: number;                   // 类型ID
}
```

#### `Region`

```typescript
interface Region {
  _key: number;                     // 星域ID
  name: { [key: string]: string };  // 多语言名称
  position: { x: number; y: number; z: number }; // 星域中心位置
  constellationIDs: number[];       // 包含的星座ID数组
}
```

#### `Jumpgate`

```typescript
interface Jumpgate {
  fromSystemId: number;  // 起始星系ID
  toSystemId: number;    // 目标星系ID
}
```

#### `SystemRenderConfig`

用于自定义单个星系的渲染样式：

```typescript
interface SystemRenderConfig {
  systemId: number;      // 星系ID
  color?: string;        // 颜色 (hex格式，如 '#FF0000')
  size?: number;         // 大小倍数 (默认1.0)
  highlighted?: boolean; // 是否高亮
  opacity?: number;      // 透明度 (0-1)
}
```

#### `SecurityColorConfig`

用于自定义安全等级颜色：

```typescript
interface SecurityColorConfig {
  highsec?: string;  // 高安颜色 (securityStatus >= 0.45)
  lowsec?: string;   // 低安颜色 (0.0 <= securityStatus < 0.45)
  nullsec?: string;  // 00颜色 (securityStatus < 0.0)
}
```

#### `CustomStyleConfig`

自定义样式：

```typescript
interface CustomStyleConfig {
  backgroundColor?: string;                   // 背景颜色
  connectionLineColor?: string;               // 连接线颜色
  connectionLineOpacity?: number;             // 连接线透明度
  highlightedConnectionLineColor?: string;    // 高亮连接线颜色
  jumpgateLineColor?: string;                 // 跳桥连接线颜色
  jumpgateLineOpacity?: number;               // 跳桥连接线透明度
  highlightedJumpgateLineColor?: string;      // 高亮跳桥连接线颜色
  labelFontSize?: number;                     // 标签字体大小
  labelColor?: string;                        // 标签颜色
}
```

#### `JumpDriveConfig`

跳跃引擎配置：

```typescript
interface JumpDriveConfig {
  originSystemId?: number;              // 起始星系ID（优先使用）
  originPosition?: { x: number; y: number; z: number };  // 自定义起始位置
  rangeLightYears: number;              // 跳跃距离（单位：光年）
  showBubble?: boolean;                 // 是否渲染可达泡泡（默认 true）
  bubbleColor?: string;                 // 泡泡颜色（默认 '#00ffff'）
  bubbleOpacity?: number;               // 泡泡透明度（默认 0.12）
  bubbleWireframeOpacity?: number;      // 泡泡线框透明度（默认 0.35）
  showReachableSystems?: boolean;       // 是否高亮可达星系（默认 true）
  reachableSystemColor?: string;        // 可达星系颜色（默认 '#00ffff'）
  reachableSystemSizeMultiplier?: number;  // 可达星系大小倍数（默认 1.6）
  reachableSystemOpacity?: number;      // 可达星系透明度（默认 1.0）
}
```

## 使用示例

### 示例 1: 基本使用

```tsx
import { EveMap3D, useMapControl } from 'eve-map-3d';

function BasicExample({ systems, stargates, regions }) {
  const mapControl = useMapControl({
    language: 'zh',
  });
  
  return (
    <EveMap3D 
      systems={systems}
      stargates={stargates}
      regions={regions}
      mapControl={mapControl} 
    />
  );
}
```

### 示例 2: 自定义颜色

```tsx
const mapControl = useMapControl({
  securityColors: {
    highsec: '#00FF00',  // 高安：绿色
    lowsec: '#FFFF00',   // 低安：黄色
    nullsec: '#FF0000',  // 00：红色
  },
});

<EveMap3D 
  systems={systems}
  stargates={stargates}
  mapControl={mapControl} 
/>
```

### 示例 3: 自定义星系样式

```tsx
const mapControl = useMapControl({
  systemRenderConfigs: [
    {
      systemId: 30000001,
      color: '#FF00FF',
      size: 2.0,
      highlighted: true,
      opacity: 1.0,
    },
    {
      systemId: 30000002,
      color: '#00FFFF',
      size: 1.5,
    },
  ],
});

<EveMap3D 
  systems={systems}
  stargates={stargates}
  mapControl={mapControl} 
/>
```

### 示例 4: 事件处理

```tsx
const mapControl = useMapControl({
  events: {
    onSystemClick: (system) => {
      console.log('选中星系:', system.name.zh || system.name.en);
    },
    onRegionClick: (region) => {
      console.log('点击星域:', region.name.zh || region.name.en);
    },
  },
});

// 从 mapControl 获取当前选中的星系
const selectedSystemId = mapControl.getSelectedSystemId();
const selectedSystem = selectedSystemId 
  ? systems.find(s => s._key === selectedSystemId) 
  : null;

// 渲染
<>
  <EveMap3D 
    systems={systems}
    stargates={stargates}
    mapControl={mapControl} 
  />
  {selectedSystem && (
    <div>
      <h3>{selectedSystem.name.zh || selectedSystem.name.en}</h3>
      <p>安全等级: {selectedSystem.securityStatus.toFixed(2)}</p>
    </div>
  )}
</>
```

### 示例 5: 程序化控制（所有摄像机操作通过 mapControl）

```tsx
function ControlledExample({ systems, stargates }) {
  const mapControl = useMapControl();
  const [systemId, setSystemId] = useState<number | null>(null);

  const handleSelectSystem = () => {
    if (systemId) {
      // 选择星系会自动聚焦和高亮，并移动摄像机
      mapControl.selectSystem(systemId);
    }
  };

  const handleFocusRegion = (regionId: number) => {
    // 高亮星域会自动移动摄像机
    mapControl.highlightRegion(regionId);
  };

  return (
    <div>
      <input
        type="number"
        value={systemId || ''}
        onChange={(e) => setSystemId(Number(e.target.value))}
        placeholder="输入星系ID"
      />
      <button onClick={handleSelectSystem}>选择星系</button>
      <button onClick={() => mapControl.resetCamera()}>重置相机</button>
      
      <EveMap3D 
        systems={systems}
        stargates={stargates}
        mapControl={mapControl} 
      />
    </div>
  );
}
```

### 示例 6: 动态更新配置

```tsx
function DynamicConfigExample({ systems, stargates }) {
  const mapControl = useMapControl({
    language: 'zh',
  });

  // 切换语言
  const toggleLanguage = () => {
    const currentConfig = mapControl.getConfig();
    mapControl.setConfig({
      language: currentConfig.language === 'zh' ? 'en' : 'zh',
    });
  };

  // 切换过滤
  const showOnlyHighSec = () => {
    mapControl.setConfig({
      systemFilter: (system) => system.securityStatus >= 0.45,
    });
  };

  return (
    <div>
      <button onClick={toggleLanguage}>切换语言</button>
      <button onClick={showOnlyHighSec}>只显示高安</button>
      <button onClick={() => mapControl.setConfig({ systemFilter: undefined })}>
        显示全部
      </button>
      
      <EveMap3D 
        systems={systems}
        stargates={stargates}
        mapControl={mapControl} 
      />
    </div>
  );
}
```

### 示例 7: 跳跃引擎配置

```tsx
const mapControl = useMapControl({
  jumpDriveConfig: {
    originSystemId: 30000142, // Jita
    rangeLightYears: 5.0,
    showBubble: true,
    bubbleColor: '#00ffff',
    bubbleOpacity: 0.15,
    showReachableSystems: true,
    reachableSystemColor: '#00ffff',
    reachableSystemSizeMultiplier: 1.8,
  },
});

// 动态更新跳跃引擎配置
const updateJumpDrive = (newSystemId: number) => {
  mapControl.setConfig({
    jumpDriveConfig: {
      originSystemId: newSystemId,
      rangeLightYears: 6.0,
    },
  });
};

<EveMap3D 
  systems={systems}
  stargates={stargates}
  mapControl={mapControl} 
/>
```

### 示例 8: 跳桥配置

```tsx
const jumpgates = [
  { fromSystemId: 30000142, toSystemId: 30002187 },
  { fromSystemId: 30002187, toSystemId: 30004759 },
];

const mapControl = useMapControl({
  style: {
    jumpgateLineColor: '#ff00ff',
    jumpgateLineOpacity: 0.8,
    highlightedJumpgateLineColor: '#ffff00',
  },
});

<EveMap3D 
  systems={systems}
  stargates={stargates}
  jumpgates={jumpgates}
  mapControl={mapControl} 
/>
```

## 操作说明

- **鼠标左键拖拽**: 旋转视角
- **鼠标右键拖拽**: 平移视角
- **滚轮**: 缩放
- **点击星系**: 选择星系（会自动聚焦和高亮）
- **点击星域标签**: 高亮星域（会自动聚焦）
- **右键菜单**: 提供重置相机、取消选择等操作
