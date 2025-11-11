# EVE 3D Map

[中文](README.zh.md)

A **React + Three.js** based 3D star map visualization library for **EVE Online**.

<img width="2550" height="1341" alt="image" src="https://github.com/user-attachments/assets/261abd34-02fe-4462-8ff5-f19b260e8d6a" />

## Features

* 3D visualization of the **EVE Online** star map
* Interactive controls (rotate, pan, zoom)
* Clickable and highlightable solar systems
* Highlight entire regions
* Customizable colors and styles
* Multi-language support (Chinese / English)

## Installation

```bash
npm install eve-map-3d
```

## Peer Dependencies

This library requires the following peer dependencies:

* `react` >= 18.0.0
* `react-dom` >= 18.0.0
* `@react-three/fiber` >= 9.0.0
* `@react-three/drei` >= 10.0.0
* `three` >= 0.180.0

## Quick Start

### 1. Prepare Data

You’ll need **EVE Online map data** in JSONL format (each line is a JSON object).

**Required files:**

* `mapSolarSystems.jsonl` — solar system data
* `mapStargates.jsonl` — stargate connection data
* `mapRegions.jsonl` — region data *(optional)*

**Example data format:**

You can find these files in the EVE SDE. It’s recommended to process and keep only the fields you need.

```json
{"_key":30000001,"name":{"zh":"Tanoo","en":"Tanoo"},"position":{"x":161891117336.0,"y":212888732625.0,"z":-73178333011.0},"regionID":10000001,"constellationID":20000001,"securityStatus":0.8583240509033203}

{"_key":50000001,"solarSystemID":30000001,"destination":{"solarSystemID":30000002,"stargateID":50000002},"position":{"x":161891117336.0,"y":212888732625.0,"z":-73178333011.0},"typeID":29624}

{"_key":10000001,"name":{"zh":"Derelik","en":"Derelik"},"position":{"x":0.0,"y":0.0,"z":0.0},"constellationIDs":[20000001,20000002]}
```

### 2. Load Data

Create a helper to load your data:

```typescript
// utils/loadEveData.ts
import type { SolarSystem, Stargate, Region } from 'eve-map-3d';

async function parseJSONL<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.trim().split('\n');
  return lines.map(line => JSON.parse(line) as T);
}

const DATA_DIR = '/data'; // adjust this based on your project structure

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

### 3. Basic Usage

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
  
  // Create a mapControl with dynamic options
  const mapControl = useMapControl({
    language: 'zh',
    events: {
      onSystemClick: (system) => {
        console.log('Clicked system:', system);
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
        console.error('Failed to load data:', error);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
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

---

## API Documentation

### Component Props

#### `EveMap3D`

| Prop         | Type            | Required | Description                                  |
| ------------ | --------------- | -------- | -------------------------------------------- |
| `systems`    | `SolarSystem[]` |          | Array of solar system data                   |
| `stargates`  | `Stargate[]`    |          | Array of stargate connections                |
| `jumpgates`  | `Jumpgate[]`    |          | Array of jump bridge connections (optional)  |
| `regions`    | `Region[]`      |          | Array of regions (optional)                  |
| `mapControl` | `MapControl`    |          | Control object (created via `useMapControl`) |

---

### Hook

#### `useMapControl(initialConfig?: Partial<MapControlConfig>)`

Returns a `MapControl` object to configure and control the map.

**Parameters:**

* `initialConfig` — optional initial configuration.

**Returns:** `MapControl` instance.

**Example usage:**

```tsx
const mapControl = useMapControl({
  language: 'zh',
  filterNewEdenOnly: true,
  events: {
    onSystemClick: (system) => console.log('Clicked system:', system),
    onRegionClick: (region) => console.log('Clicked region:', region),
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

// Dynamically update configuration
mapControl.setConfig({
  language: 'en',
  filterNewEdenOnly: false,
});

// Get current config
const currentConfig = mapControl.getConfig();
```

---

### Camera Control Methods

```tsx
mapControl.resetCamera();
mapControl.focusSystem(30000001);
mapControl.focusSystem(30000001, 2000);
mapControl.focusRegion(10000001);
mapControl.focusRegion(10000001, 1500);
mapControl.setCameraPosition(0, 0, 1e17);
mapControl.setCameraTarget(0, 0, 0);
const position = mapControl.getCameraPosition();
const target = mapControl.getCameraTarget();
```

### State Control Methods

```tsx
mapControl.selectSystem(30000001);
mapControl.selectSystem(null);
const selectedId = mapControl.getSelectedSystemId();

mapControl.highlightRegion(10000001);
mapControl.highlightRegion(null);
const highlightedRegionId = mapControl.getHighlightedRegionId();

mapControl.highlightSystems([30000001, 30000002]);
const highlightedSystemIds = mapControl.getHighlightedSystemIds();
```

---

## Configuration Interfaces

### `MapControlConfig`

```typescript
interface MapControlConfig {
  language?: 'zh' | 'en';
  filterNewEdenOnly?: boolean;
  systemFilter?: (system: SolarSystem) => boolean;

  systemRenderConfigs?: SystemRenderConfig[];
  securityColors?: SecurityColorConfig;
  style?: CustomStyleConfig;

  containerStyle?: React.CSSProperties;
  containerClassName?: string;

  jumpDriveConfig?: JumpDriveConfig;

  events?: {
    onSystemClick?: (system: SolarSystem) => void;
    onRegionClick?: (region: Region) => void;
  };
}
```

---

### Type Definitions

#### `SolarSystem`

```typescript
interface SolarSystem {
  _key: number;
  name: { [key: string]: string };
  position: { x: number; y: number; z: number };
  regionID: number;
  constellationID: number;
  securityStatus: number;
  securityClass?: string;
}
```

#### `Stargate`

```typescript
interface Stargate {
  _key: number;
  solarSystemID: number;
  destination: {
    solarSystemID: number;
    stargateID: number;
  };
  position: { x: number; y: number; z: number };
  typeID: number;
}
```

#### `Region`

```typescript
interface Region {
  _key: number;
  name: { [key: string]: string };
  position: { x: number; y: number; z: number };
  constellationIDs: number[];
}
```

#### `Jumpgate`

```typescript
interface Jumpgate {
  fromSystemId: number;
  toSystemId: number;
}
```

#### `SystemRenderConfig`

```typescript
interface SystemRenderConfig {
  systemId: number;
  color?: string;
  size?: number;
  highlighted?: boolean;
  opacity?: number;
}
```

#### `SecurityColorConfig`

```typescript
interface SecurityColorConfig {
  highsec?: string;
  lowsec?: string;
  nullsec?: string;
}
```

#### `CustomStyleConfig`

```typescript
interface CustomStyleConfig {
  backgroundColor?: string;
  connectionLineColor?: string;
  connectionLineOpacity?: number;
  highlightedConnectionLineColor?: string;
  jumpgateLineColor?: string;
  jumpgateLineOpacity?: number;
  highlightedJumpgateLineColor?: string;
  labelFontSize?: number;
  labelColor?: string;
}
```

#### `JumpDriveConfig`

```typescript
interface JumpDriveConfig {
  originSystemId?: number;
  originPosition?: { x: number; y: number; z: number };
  rangeLightYears: number;
  showBubble?: boolean;
  bubbleColor?: string;
  bubbleOpacity?: number;
  bubbleWireframeOpacity?: number;
  showReachableSystems?: boolean;
  reachableSystemColor?: string;
  reachableSystemSizeMultiplier?: number;
  reachableSystemOpacity?: number;
}
```

---

## Usage Examples

### Example 1: Basic Usage

```tsx
import { EveMap3D, useMapControl } from 'eve-map-3d';

function BasicExample({ systems, stargates, regions }) {
  const mapControl = useMapControl({ language: 'zh' });
  
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

### Example 2: Custom Security Colors

```tsx
const mapControl = useMapControl({
  securityColors: {
    highsec: '#00FF00',
    lowsec: '#FFFF00',
    nullsec: '#FF0000',
  },
});
```

### Example 3: Custom System Styles

```tsx
const mapControl = useMapControl({
  systemRenderConfigs: [
    { systemId: 30000001, color: '#FF00FF', size: 2.0, highlighted: true },
    { systemId: 30000002, color: '#00FFFF', size: 1.5 },
  ],
});
```

### Example 4: Event Handling

```tsx
const mapControl = useMapControl({
  events: {
    onSystemClick: (system) => {
      console.log('Selected system:', system.name.zh || system.name.en);
    },
    onRegionClick: (region) => {
      console.log('Clicked region:', region.name.zh || region.name.en);
    },
  },
});
```

### Example 5: Programmatic Camera Control

```tsx
function ControlledExample({ systems, stargates }) {
  const mapControl = useMapControl();
  const [systemId, setSystemId] = useState<number | null>(null);

  const handleSelectSystem = () => {
    if (systemId) {
      mapControl.selectSystem(systemId);
    }
  };

  const handleFocusRegion = (regionId: number) => {
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

### Example 6: Dynamic Configuration

```tsx
function DynamicConfigExample({ systems, stargates }) {
  const mapControl = useMapControl({
    language: 'zh',
  });

  const toggleLanguage = () => {
    const currentConfig = mapControl.getConfig();
    mapControl.setConfig({
      language: currentConfig.language === 'zh' ? 'en' : 'zh',
    });
  };

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

### Example 7: Jump Drive Configuration

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

### Example 8: Jump Bridge Configuration

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

---

## Controls

* **Left Mouse Drag** — rotate view
* **Right Mouse Drag** — pan view
* **Scroll Wheel** — zoom in/out
* **Click System** — select and highlight system
* **Click Region Label** — highlight and focus region
* **Right-Click Menu** — reset camera or clear selection
