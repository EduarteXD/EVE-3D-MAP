# EVE 3D Map

一个基于 React 和 Three.js 的 EVE Online 3D 星图可视化组件库。

<img width="2551" height="1337" alt="image" src="https://github.com/user-attachments/assets/a8392b0b-9ebe-4b60-812a-86e9b3edaa2d" />

## 特性

- 🎨 3D 可视化 EVE Online 星图
- 🖱️ 交互式操作（旋转、平移、缩放）
- 🎯 星系点击和高亮
- 🌌 星域高亮显示
- 🎨 自定义颜色和样式
- 🌍 多语言支持（中文/英文）
- ⚡ 高性能渲染（使用 InstancedMesh）

## 安装

### 使用 npm

```bash
npm install eve-map-3d
```

### 使用 pnpm

```bash
pnpm add eve-map-3d
```

### 使用 yarn

```bash
yarn add eve-map-3d
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

```json
// mapSolarSystems.jsonl
{"_key":30000001,"name":{"zh":"Tanoo","en":"Tanoo"},"position":{"x":161891117336.0,"y":212888732625.0,"z":-73178333011.0},"regionID":10000001,"constellationID":20000001,"securityStatus":0.8583240509033203}

// mapStargates.jsonl
{"_key":50000001,"solarSystemID":30000001,"destination":{"solarSystemID":30000002,"stargateID":50000002},"position":{"x":161891117336.0,"y":212888732625.0,"z":-73178333011.0},"typeID":29624}

// mapRegions.jsonl
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
import { loadSolarSystems, loadStargates, loadRegions } from './utils/loadEveData';

function App() {
  const mapControl = useMapControl();
  const [systems, setSystems] = useState<SolarSystem[]>([]);
  const [stargates, setStargates] = useState<Stargate[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);

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
        language="zh"
        mapControl={mapControl}
        events={{
          onSystemClick: (system) => {
            console.log('点击了星系:', system);
          },
        }}
      />
    </div>
  );
}

export default App;
```

## API 文档

### 组件 Props

#### `EveMap3D`

| 属性 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `systems` | `SolarSystem[]` | ✅ | - | 太阳系数据数组 |
| `stargates` | `Stargate[]` | ✅ | - | 星门连接数据数组 |
| `regions` | `Region[]` | ❌ | `[]` | 星域数据数组（用于显示星域标签） |
| `language` | `'zh' \| 'en'` | ❌ | `'zh'` | 语言设置 |
| `filterNewEdenOnly` | `boolean` | ❌ | `true` | 是否只显示 New Eden 星系 |
| `systemFilter` | `(system: SolarSystem) => boolean` | ❌ | - | 自定义过滤函数 |
| `systemRenderConfigs` | `SystemRenderConfig[]` | ❌ | - | 星系渲染配置（自定义颜色、大小等） |
| `securityColors` | `SecurityColorConfig` | ❌ | - | 安全等级颜色配置 |
| `highlightedRegionId` | `number \| null` | ❌ | - | 高亮的星域ID |
| `focus` | `FocusConfig` | ❌ | - | 聚焦配置 |
| `events` | `EveMap3DEvents` | ❌ | - | 事件回调 |
| `style` | `CustomStyleConfig` | ❌ | - | 自定义样式 |
| `mapControl` | `MapControl` | ❌ | - | 地图控制对象（通过 `useMapControl` 生成） |
| `containerStyle` | `React.CSSProperties` | ❌ | - | 容器样式 |
| `containerClassName` | `string` | ❌ | - | 容器类名 |

### Hook

#### `useMapControl()`

返回一个 `MapControl` 对象，用于程序化控制地图。

```tsx
const mapControl = useMapControl();

// 重置相机
mapControl.resetCamera?.();

// 聚焦到指定星系
mapControl.focusSystem?.(30000001);

// 聚焦到指定星域
mapControl.focusRegion?.(10000001);

// 设置相机位置
mapControl.setCameraPosition?.(0, 0, 100000000000);

// 获取相机位置
const position = mapControl.getCameraPosition?.();
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

#### `FocusConfig`

用于聚焦到特定星系或星域：

```typescript
interface FocusConfig {
  type: 'system' | 'region';  // 聚焦类型
  targetId: number;            // 目标ID
  highlight?: boolean;         // 是否高亮
  animationDuration?: number;  // 动画时长（毫秒，默认1500）
}
```

#### `EveMap3DEvents`

事件回调：

```typescript
interface EveMap3DEvents {
  onSystemClick?: (system: SolarSystem) => void;      // 点击星系时触发
  onFocusComplete?: (config: FocusConfig) => void;    // 聚焦完成时触发
}
```

#### `CustomStyleConfig`

自定义样式：

```typescript
interface CustomStyleConfig {
  backgroundColor?: string;                    // 背景颜色
  connectionLineColor?: string;               // 连接线颜色
  connectionLineOpacity?: number;             // 连接线透明度
  highlightedConnectionLineColor?: string;    // 高亮连接线颜色
  labelFontSize?: number;                     // 标签字体大小
  labelColor?: string;                        // 标签颜色
}
```

## 使用示例

### 示例 1: 基本使用

```tsx
import { EveMap3D, useMapControl } from 'eve-map-3d';

function BasicExample() {
  const mapControl = useMapControl();
  
  return (
    <EveMap3D
      systems={systems}
      stargates={stargates}
      regions={regions}
      language="zh"
      mapControl={mapControl}
    />
  );
}
```

### 示例 2: 自定义颜色

```tsx
<EveMap3D
  systems={systems}
  stargates={stargates}
  securityColors={{
    highsec: '#00FF00',  // 高安：绿色
    lowsec: '#FFFF00',   // 低安：黄色
    nullsec: '#FF0000',  // 00：红色
  }}
  mapControl={mapControl}
/>
```

### 示例 3: 自定义星系样式

```tsx
<EveMap3D
  systems={systems}
  stargates={stargates}
  systemRenderConfigs={[
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
  ]}
  mapControl={mapControl}
/>
```

### 示例 4: 事件处理

```tsx
const [selectedSystem, setSelectedSystem] = useState<SolarSystem | null>(null);

<EveMap3D
  systems={systems}
  stargates={stargates}
  mapControl={mapControl}
  events={{
    onSystemClick: (system) => {
      setSelectedSystem(system);
      console.log('选中星系:', system.name.zh || system.name.en);
    },
    onFocusComplete: (config) => {
      console.log('聚焦完成:', config);
    },
  }}
/>

{selectedSystem && (
  <div>
    <h3>{selectedSystem.name.zh || selectedSystem.name.en}</h3>
    <p>安全等级: {selectedSystem.securityStatus.toFixed(2)}</p>
  </div>
)}
```

### 示例 5: 程序化控制

```tsx
function ControlledExample() {
  const mapControl = useMapControl();
  const [systemId, setSystemId] = useState<number | null>(null);

  const handleFocusSystem = () => {
    if (systemId) {
      mapControl.focusSystem?.(systemId);
    }
  };

  return (
    <div>
      <input
        type="number"
        value={systemId || ''}
        onChange={(e) => setSystemId(Number(e.target.value))}
        placeholder="输入星系ID"
      />
      <button onClick={handleFocusSystem}>聚焦到星系</button>
      <button onClick={() => mapControl.resetCamera?.()}>重置相机</button>
      
      <EveMap3D
        systems={systems}
        stargates={stargates}
        mapControl={mapControl}
      />
    </div>
  );
}
```

### 示例 6: 高亮星域

```tsx
const [highlightedRegionId, setHighlightedRegionId] = useState<number | null>(null);

<EveMap3D
  systems={systems}
  stargates={stargates}
  regions={regions}
  highlightedRegionId={highlightedRegionId}
  mapControl={mapControl}
/>

<select
  value={highlightedRegionId || ''}
  onChange={(e) => setHighlightedRegionId(Number(e.target.value) || null)}
>
  <option value="">无</option>
  {regions.map(region => (
    <option key={region._key} value={region._key}>
      {region.name.zh || region.name.en}
    </option>
  ))}
</select>
```

### 示例 7: 自定义过滤

```tsx
// 只显示高安星系
<EveMap3D
  systems={systems}
  stargates={stargates}
  systemFilter={(system) => system.securityStatus >= 0.45}
  mapControl={mapControl}
/>

// 只显示特定星域的星系
<EveMap3D
  systems={systems}
  stargates={stargates}
  systemFilter={(system) => system.regionID === 10000001}
  mapControl={mapControl}
/>
```

### 示例 8: 聚焦配置

```tsx
const [focus, setFocus] = useState<FocusConfig | undefined>();

// 聚焦到星系
const focusToSystem = (systemId: number) => {
  setFocus({
    type: 'system',
    targetId: systemId,
    highlight: true,
    animationDuration: 2000,
  });
};

// 聚焦到星域
const focusToRegion = (regionId: number) => {
  setFocus({
    type: 'region',
    targetId: regionId,
    highlight: true,
  });
};

<EveMap3D
  systems={systems}
  stargates={stargates}
  regions={regions}
  focus={focus}
  mapControl={mapControl}
  events={{
    onFocusComplete: (config) => {
      console.log('聚焦完成:', config);
      setFocus(undefined); // 清除聚焦配置
    },
  }}
/>
```

## 操作说明

- **鼠标左键拖拽**: 旋转视角
- **鼠标右键拖拽**: 平移视角
- **滚轮**: 缩放
- **点击星系**: 查看星系详情（触发 `onSystemClick` 事件）

## 开发

### 构建库

```bash
pnpm build:lib
```

### 开发模式

```bash
pnpm dev
```

### 预览

```bash
pnpm preview
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
