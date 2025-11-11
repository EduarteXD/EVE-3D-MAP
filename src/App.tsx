import { useState, useMemo, useEffect, useCallback } from 'react'
import { EveMap3D, useMapControl, isNewEdenSystem, type SolarSystem, type Stargate, type Region, type Jumpgate, type JumpDriveConfig } from './lib'
import { loadSolarSystems, loadStargates, loadRegions } from './utils/loadEveData'
import './App.css'

type Language = 'zh' | 'en'

function App() {
  const [systems, setSystems] = useState<SolarSystem[]>([])
  const [stargates, setStargates] = useState<Stargate[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jumpDriveEnabled, setJumpDriveEnabled] = useState(true)
  const [jumpDriveOriginId, setJumpDriveOriginId] = useState<number>(30004937)
  const [jumpDriveOriginInput, setJumpDriveOriginInput] = useState('30004937')
  const [jumpDriveRange, setJumpDriveRange] = useState<number>(5)
  const [jumpDriveError, setJumpDriveError] = useState<string | null>(null)
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
  const language: Language = 'en'

  // Demo 跳桥连接
  const jumpgates = useMemo<Jumpgate[]>(() => {
    if (systems.length === 0) {
      return []
    }

    const resolveSystemId = (searchName: string): number | undefined => {
      const normalized = searchName.trim().toLowerCase()
      const match = systems.find(system => {
        const enName = system.name.en?.toLowerCase()
        const zhName = system.name.zh?.toLowerCase()
        return enName === normalized || zhName === normalized
      })
      return match?._key
    }

    const pairs: Array<[string, string]> = [
      ['TCAG-3', 'L5D-ZL'],
      ['F-M1FU', 'L-YMYU']
    ]

    const resolved: Jumpgate[] = []
    pairs.forEach(([fromName, toName]) => {
      const fromId = resolveSystemId(fromName)
      const toId = resolveSystemId(toName)
      if (fromId !== undefined && toId !== undefined) {
        resolved.push({ fromSystemId: fromId, toSystemId: toId })
      }
    })

    return resolved
  }, [systems])

  const jumpDriveConfig = useMemo<JumpDriveConfig | undefined>(() => {
    if (!jumpDriveEnabled) {
      return undefined
    }
    return {
      originSystemId: jumpDriveOriginId,
      rangeLightYears: Math.max(jumpDriveRange, 0),
      showBubble: true,
      bubbleColor: '#00ffff',
      bubbleOpacity: 0.06,
    }
  }, [jumpDriveEnabled, jumpDriveOriginId, jumpDriveRange])

  // 创建 mapControl（不包含静态数据）
  const mapControl = useMapControl({
    language: language,
    filterNewEdenOnly: true,
    jumpDriveConfig: jumpDriveConfig,
    events: {
      onSystemClick: (system) => {
        console.log('点击了星系:', system);
      },
      onRegionClick: (region) => {
        console.log('点击了星域:', region);
      },
    },
  })

  // 加载数据（只执行一次）
  useEffect(() => {
    const loadData = async () => {
      try {
        const [systemsData, stargatesData, regionsData] = await Promise.all([
          loadSolarSystems(),
          loadStargates(),
          loadRegions(),
        ])
        setSystems(systemsData)
        setStargates(stargatesData)
        setRegions(regionsData)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      }
    }
    loadData()
  }, []) // 只在组件挂载时执行一次

  // 更新跳跃引擎配置
  useEffect(() => {
    mapControl.setConfig({
      jumpDriveConfig: jumpDriveConfig,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpDriveConfig]) // mapControl 是稳定的引用，不需要作为依赖

  // 过滤New Eden系统
  const filteredSystems = useMemo(() => {
    return systems.filter(s => isNewEdenSystem(s._key))
  }, [systems])

  // 计算连接数
  const systemMap = useMemo(() => {
    return new Map(systems.map(system => [system._key, system]))
  }, [systems])

  const connections = useMemo(() => {
    if (filteredSystems.length === 0 || stargates.length === 0) return 0

    const systemSet = new Set(filteredSystems.map(s => s._key))
    const connectionSet = new Set<string>()

    stargates.forEach(stargate => {
      const fromSystem = systemMap.get(stargate.solarSystemID)
      const toSystem = systemMap.get(stargate.destination.solarSystemID)

      if (
        fromSystem &&
        toSystem &&
        systemSet.has(fromSystem._key) &&
        systemSet.has(toSystem._key)
      ) {
        const minId = Math.min(fromSystem._key, toSystem._key)
        const maxId = Math.max(fromSystem._key, toSystem._key)
        const key = `${minId}-${maxId}`
        connectionSet.add(key)
      }
    })

    return connectionSet.size
  }, [stargates, filteredSystems, systemMap])

  const resolveSystemIdentifier = useCallback((value: string) => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return undefined
    }

    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric)) {
      if (systemMap.has(numeric)) {
        return numeric
      }
    }

    const normalized = trimmed.toLowerCase()
    for (const system of systems) {
      const enName = system.name.en?.toLowerCase()
      const zhName = system.name.zh?.toLowerCase()
      if (enName === normalized || zhName === normalized) {
        return system._key
      }
    }

    return undefined
  }, [systemMap, systems])

  const jumpDriveOriginName = useMemo(() => {
    const system = systemMap.get(jumpDriveOriginId)
    if (!system) {
      return null
    }

    return system.name?.[language] || system.name?.['en'] || `${system._key}`
  }, [systemMap, jumpDriveOriginId, language])

  useEffect(() => {
    const system = systemMap.get(jumpDriveOriginId)
    if (!system) {
      return
    }
    const displayName = system.name?.[language] || system.name?.['zh'] || `${system._key}`
    if (displayName && jumpDriveOriginInput === `${jumpDriveOriginId}`) {
      setJumpDriveOriginInput(displayName)
    }
  }, [systemMap, jumpDriveOriginId, language, jumpDriveOriginInput])

  const handleApplyJumpDriveOrigin = useCallback(() => {
    const resolved = resolveSystemIdentifier(jumpDriveOriginInput)
    if (resolved !== undefined) {
      setJumpDriveOriginId(resolved)
      const system = systemMap.get(resolved)
      const displayName = system?.name?.[language] || system?.name?.['zh'] || `${resolved}`
      setJumpDriveOriginInput(displayName ?? `${resolved}`)
      setJumpDriveError(null)
      // 通过 mapControl 聚焦到星系
      mapControl.focusSystem(resolved)
      return
    }

    setJumpDriveError('System not found. Please enter a valid ID or name.')
  }, [resolveSystemIdentifier, jumpDriveOriginInput, systemMap, language, mapControl])

  // 翻译文本
  const t = useMemo(() => {
    return {
      zh: {
        title: 'EVE 3D 星图',
        systemsTotal: '太阳系总数',
        connections: '星门连接',
        jumpbridges: '跳桥连接',
        highlightRegion: '高亮星域',
        none: '无',
        selectedSystem: '选中系统',
        name: '名称',
        id: 'ID',
        security: '安全等级',
        coordinates: '坐标',
        instructions: '操作说明',
        dragLeft: '鼠标左键拖拽: 旋转',
        dragRight: '鼠标右键拖拽: 平移',
        scroll: '滚轮: 缩放',
        clickSystem: '点击太阳系: 查看详情',
        selectRegion: '选择星域: 高亮显示',
        rightClick: '右键点击: 打开菜单',
      },
      en: {
        title: 'EVE 3D Star Map',
        systemsTotal: 'Total Systems',
        connections: 'Stargate Connections',
        jumpbridges: 'Jump Bridge Connections',
        highlightRegion: 'Highlight Region',
        none: 'None',
        selectedSystem: 'Selected System',
        name: 'Name',
        id: 'ID',
        security: 'Security Status',
        coordinates: 'Coordinates',
        instructions: 'Instructions',
        dragLeft: 'Left Click Drag: Rotate',
        dragRight: 'Right Click Drag: Pan',
        scroll: 'Scroll: Zoom',
        clickSystem: 'Click System: View Details',
        selectRegion: 'Select Region: Highlight',
        rightClick: 'Right Click: Open Menu',
      },
    }[language]
  }, [language])

  // 可用的星域列表（只包含有New Eden系统的星域）
  const availableRegions = useMemo(() => {
    return regions
      .filter(region => {
        return filteredSystems.some(system => system.regionID === region._key)
      })
      .sort((a, b) => {
        const nameA = a.name?.[language] || a.name?.['en'] || ''
        const nameB = b.name?.[language] || b.name?.['en'] || ''
        return nameA.localeCompare(nameB)
      })
  }, [regions, filteredSystems, language])

  // 从 mapControl 获取当前选中的星系和高亮的星域
  const selectedSystemId = mapControl.getSelectedSystemId()
  const selectedSystem = selectedSystemId ? systemMap.get(selectedSystemId) : null
  const highlightedRegionId = mapControl.getHighlightedRegionId()

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white">
        <div>Loading star map data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-red-500">
        <div>
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      {/* 静态数据直接传入 EveMap3D 组件 */}
      <EveMap3D
        systems={systems}
        stargates={stargates}
        jumpgates={jumpgates}
        regions={regions}
        mapControl={mapControl}
      />

      {/* 控制面板 */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '15px',
          borderRadius: '8px',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '14px',
          maxWidth: '300px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', pointerEvents: 'auto' }}>
          <h3 style={{ margin: 0 }}>{t.title}</h3>
          <button
            onClick={() => setIsPanelExpanded(!isPanelExpanded)}
            style={{
              background: 'transparent',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '12px',
              marginLeft: '10px',
            }}
            title={isPanelExpanded ? 'Collapse' : 'Expand'}
          >
            {isPanelExpanded ? '−' : '+'}
          </button>
        </div>

        {isPanelExpanded && (
          <>
            <div>
              {t.systemsTotal}: {filteredSystems.length}
            </div>
            <div>
              {t.connections}: {connections}
            </div>
            <div>
              {t.jumpbridges}: {jumpgates.length}
            </div>

            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444', pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={jumpDriveEnabled}
                    onChange={e => setJumpDriveEnabled(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Jump Drive Bubble</span>
                </label>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#ccc' }}>
                <div>Current Origin: {jumpDriveOriginName ? `${jumpDriveOriginName} (${jumpDriveOriginId})` : jumpDriveOriginId}</div>
              </div>
              <div style={{ marginTop: '6px' }}>
                <input
                  type="text"
                  value={jumpDriveOriginInput}
                  onChange={e => setJumpDriveOriginInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleApplyJumpDriveOrigin()
                    }
                  }}
                  placeholder="Enter system ID or name"
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    background: '#222',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyJumpDriveOrigin}
                  style={{
                    marginTop: '6px',
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid #0ff',
                    background: '#034a4a',
                    color: '#0ff',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Apply Origin
                </button>
              </div>
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'block', marginBottom: '4px' }}>Jump Range (LY)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={jumpDriveRange}
                  onChange={e => {
                    const value = Number(e.target.value)
                    if (!Number.isNaN(value)) {
                      setJumpDriveRange(value)
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    background: '#222',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </div>
              {jumpDriveError && (
                <div style={{ marginTop: '6px', color: '#ff6666', fontSize: '12px' }}>
                  {jumpDriveError}
                </div>
              )}
            </div>

            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
              <div>
                <strong>{t.highlightRegion}:</strong>
              </div>
              <select
                value={highlightedRegionId || ''}
                onChange={e => {
                  const value = e.target.value ? Number(e.target.value) : null
                  // 通过 mapControl 高亮星域（会自动移动摄像机）
                  mapControl.highlightRegion(value)
                }}
                style={{
                  width: '100%',
                  marginTop: '5px',
                  padding: '5px',
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  fontSize: '12px',
                  pointerEvents: 'auto',
                }}
              >
                <option value="">{t.none}</option>
                {availableRegions.map(region => (
                  <option key={region._key} value={region._key}>
                    {region.name?.[language] || region.name?.['en'] || `Region ${region._key}`}
                  </option>
                ))}
              </select>
            </div>

            {selectedSystem && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
                <div>
                  <strong>{t.selectedSystem}:</strong>
                </div>
                <div>
                  {t.name}: {selectedSystem.name?.[language] || selectedSystem.name?.['en'] || `${selectedSystem._key}`}
                </div>
                <div>
                  {t.id}: {selectedSystem._key}
                </div>
                <div>
                  {t.security}: {selectedSystem.securityStatus.toFixed(2)}
                </div>
                <div>
                  {t.coordinates}: ({selectedSystem.position.x.toExponential(2)}, {selectedSystem.position.y.toExponential(2)}, {selectedSystem.position.z.toExponential(2)})
                </div>
              </div>
            )}

            <div style={{ marginTop: '10px', fontSize: '12px', color: '#aaa' }}>
              <div>{t.instructions}:</div>
              <div>• {t.dragLeft}</div>
              <div>• {t.dragRight}</div>
              <div>• {t.scroll}</div>
              <div>• {t.clickSystem}</div>
              <div>• {t.selectRegion}</div>
              <div>• {t.rightClick}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
