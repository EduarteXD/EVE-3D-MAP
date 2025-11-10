import { useState, useMemo, useEffect } from 'react'
import { EveMap3D, useMapControl, isNewEdenSystem, type SolarSystem, type Stargate, type Region } from './lib'
import { loadSolarSystems, loadStargates, loadRegions } from './utils/loadEveData'
import './App.css'

function App() {
  const mapControl = useMapControl()
  const [systems, setSystems] = useState<SolarSystem[]>([])
  const [stargates, setStargates] = useState<Stargate[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [selectedSystem, setSelectedSystem] = useState<SolarSystem | null>(null)
  const [highlightedRegionId, setHighlightedRegionId] = useState<number | null>(null)
  const [hasUserSelectedRegion, setHasUserSelectedRegion] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const language: 'zh' | 'en' = 'zh'

  // 加载数据
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
  }, [])

  // 过滤New Eden系统
  const filteredSystems = useMemo(() => {
    return systems.filter(s => isNewEdenSystem(s._key))
  }, [systems])

  // 计算连接数
  const connections = useMemo(() => {
    if (filteredSystems.length === 0 || stargates.length === 0) return 0

    const systemSet = new Set(filteredSystems.map(s => s._key))
    const systemMap = new Map(systems.map(s => [s._key, s]))
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
  }, [systems, stargates, filteredSystems])

  // 翻译文本
  const t = useMemo(() => {
    return {
      zh: {
        title: 'EVE 3D 星图',
        systemsTotal: '太阳系总数',
        connections: '星门连接',
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
      },
      en: {
        title: 'EVE 3D Star Map',
        systemsTotal: 'Total Systems',
        connections: 'Stargate Connections',
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
        const nameA = language === 'zh' ? a.name.zh || a.name.en || '' : a.name.en || a.name.zh || ''
        const nameB = language === 'zh' ? b.name.zh || b.name.en || '' : b.name.en || b.name.zh || ''
        return nameA.localeCompare(nameB, language === 'zh' ? 'zh-CN' : 'en')
      })
  }, [regions, filteredSystems, language])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white">
        <div>{language === 'zh' ? '加载星图数据中...' : 'Loading star map data...'}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-red-500">
        <div>
          {language === 'zh' ? '错误' : 'Error'}: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <EveMap3D
        systems={systems}
        stargates={stargates}
        regions={regions}
        language={language}
        filterNewEdenOnly={true}
        highlightedRegionId={hasUserSelectedRegion ? highlightedRegionId : undefined}
        mapControl={mapControl}
        events={{
          onSystemClick: (system) => {
            setSelectedSystem(system)
            // 点击新星系时，如果用户之前选择了星域，清除星域选择
            if (hasUserSelectedRegion) {
              setHighlightedRegionId(null)
              setHasUserSelectedRegion(false)
            }
          },
        }}
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
        <h3 style={{ margin: '0 0 10px 0' }}>{t.title}</h3>
        <div>
          {t.systemsTotal}: {filteredSystems.length}
        </div>
        <div>
          {t.connections}: {connections}
        </div>

        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
          <div>
            <strong>{t.highlightRegion}:</strong>
          </div>
          <select
            value={highlightedRegionId || ''}
            onChange={e => {
              const value = e.target.value ? Number(e.target.value) : null
              setHighlightedRegionId(value)
              setHasUserSelectedRegion(true)
              // 选择新星域时，清除选中的星系
              setSelectedSystem(null)
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
                {language === 'zh' ? region.name.zh || region.name.en : region.name.en || region.name.zh || `Region ${region._key}`}
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
              {t.name}: {language === 'zh' ? selectedSystem.name.zh || selectedSystem.name.en : selectedSystem.name.en || selectedSystem.name.zh}
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
        </div>
      </div>
    </div>
  )
}

export default App
