function getBlockFromUrlParam() {
  const params = new URL(document.location.href).searchParams
  const block = params.get("block")
  console.log(block)
  return block
}

function getSmallBlockFromUrlParam() {
  const params = new URL(document.location.href).searchParams
  const smallBlock = params.get("sb")
  console.log(smallBlock)
  return smallBlock
}

function findKeyByAreaName(data, areaName) {
  for (const key in data) {
    if (data[key].area_name === areaName) {
      return key;
    }
  }
  return null;
}

function filterDataByAreaIdAndSmallBlock(data, areaId, smallBlockId) {
  return data.filter(item => {
      return item.area_id === areaId && item.name.split('-')[0] === String(smallBlockId);
  });
}

function getStatusText(status) {
  statusDict = {0: "未", 1: "完了", 2: "異常", 3: "予約", 4: "要確認", 5: "異常対応中", 6: "削除"}
  return statusDict[status]
}

function getStatusColor(status) {
switch (status) {
  case 0:
    return '#0288D1';
  case 1:
    return '#FFD600';
  case 2:
    return '#E65100';
  case 3:
    return '#0F9D58';
  case 4:
    return '#FF9706';
  case 5:
    return '#9106E9';
  case 6:
    return '#FFD600';
  default:
    return '#0288D1';
}
}

function getPinNote(note) {
  if (note == null) {
    return "なし"
  } else {
    return note
  }
}

// ===== ヒートマップ機能 =====

// ヒートマップ用変数
let heatmapLayer = null;
let currentDisplayMode = 'pins'; // 'pins' or 'heatmap'

// 進捗率に基づく色分け設定
const PROGRESS_COLORS = {
  excellent: { min: 95, color: '#2E7D32', label: '95%以上' },    // 濃い緑
  good: { min: 85, color: '#66BB6A', label: '85-94%' },         // 緑
  average: { min: 70, color: '#FFD54F', label: '70-84%' },      // 黄
  poor: { min: 50, color: '#FF8A65', label: '50-69%' },         // オレンジ
  bad: { min: 25, color: '#EF5350', label: '25-49%' },          // 赤
  worst: { min: 0, color: '#B71C1C', label: '0-24%' }           // 濃い赤
};

// 進捗率に基づく色取得
function getProgressColor(progress) {
  for (const key in PROGRESS_COLORS) {
    if (progress >= PROGRESS_COLORS[key].min) {
      return PROGRESS_COLORS[key].color;
    }
  }
  return PROGRESS_COLORS.worst.color;
}

// 地区名から進捗率を計算
function calculateAreaProgress(pins, areaName) {
  const areaPins = pins.filter(pin => {
    // pin.nameから地区名を抽出（例：'荒川一丁目-01-001' → '荒川一丁目'）
    const pinAreaName = extractAreaNameFromPin(pin.name);
    return pinAreaName === areaName;
  });
  
  if (areaPins.length === 0) return { progress: 0, completed: 0, total: 0 };
  
  const completed = areaPins.filter(pin => pin.status === 1).length; // 完了のステータスは1
  const total = areaPins.length;
  const progress = (completed / total * 100);
  
  return {
    progress: Math.round(progress * 10) / 10,
    completed,
    total
  };
}

// ピン名から地区名を抽出
function extractAreaNameFromPin(pinName) {
  // 例：'荒川一丁目-01-001' → '荒川一丁目'
  // 例：'南千住二丁目-03-015' → '南千住二丁目'
  const parts = pinName.split('-');
  return parts[0] || 'その他';
}

// 荒川区の全地区名を取得
function getArakawaAreaNames() {
  const areas = [];
  const arakawaAreas = [
    { name: '荒川', cho_max: 8 },
    { name: '町屋', cho_max: 8 },
    { name: '東尾久', cho_max: 9 },
    { name: '西尾久', cho_max: 8 },
    { name: '東日暮里', cho_max: 6 },
    { name: '西日暮里', cho_max: 6 },
    { name: '南千住', cho_max: 8 }
  ];
  
  arakawaAreas.forEach(area => {
    for (let cho = 1; cho <= area.cho_max; cho++) {
      areas.push(`${area.name}${cho}丁目`);
    }
  });
  
  return areas;
}

// ヒートマップ用GeoJSONデータ作成
async function createProgressHeatmap(pins) {
  const areaNames = getArakawaAreaNames();
  const features = [];
  
  for (const areaName of areaNames) {
    try {
      // 地区ポリゴンデータ取得
      const geoJsonUrl = `https://uedayou.net/loa/東京都荒川区${areaName}.geojson`;
      const response = await fetch(geoJsonUrl);
      
      if (!response.ok) continue;
      
      const geoData = await response.json();
      const progressData = calculateAreaProgress(pins, areaName);
      
      // GeoJSONの各フィーチャーに進捗データを追加
      geoData.features.forEach(feature => {
        feature.properties = {
          ...feature.properties,
          areaName: areaName,
          progress: progressData.progress,
          completed: progressData.completed,
          total: progressData.total
        };
      });
      
      features.push(...geoData.features);
      
    } catch (error) {
      console.warn(`ヒートマップデータ取得失敗: ${areaName}`, error);
    }
  }
  
  return {
    type: 'FeatureCollection',
    features: features
  };
}

// ヒートマップポリゴンのスタイル設定
function getHeatmapStyle(feature) {
  const progress = feature.properties.progress || 0;
  
  return {
    fillColor: getProgressColor(progress),
    weight: 2,
    opacity: 1,
    color: 'white',
    dashArray: '3',
    fillOpacity: 0.7
  };
}

// ポリゴンのインタラクション設定
function onEachHeatmapFeature(feature, layer) {
  const props = feature.properties;
  
  layer.on({
    mouseover: function(e) {
      // ハイライト
      e.target.setStyle({
        weight: 3,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.9
      });
      
      // 情報パネル表示
      showAreaInfo(props.areaName, props.progress, props.completed, props.total);
    },
    
    mouseout: function(e) {
      // スタイルリセット
      heatmapLayer.resetStyle(e.target);
      hideAreaInfo();
    },
    
    click: function(e) {
      // 地区にズーム
      map.fitBounds(e.target.getBounds());
    }
  });
}

// 地区情報パネル表示
function showAreaInfo(areaName, progress, completed, total) {
  const infoPanel = document.getElementById('heatmap-area-info-panel');
  if (infoPanel) {
    document.getElementById('heatmap-area-name').textContent = areaName;
    document.getElementById('heatmap-area-progress').textContent = `${progress}%`;
    document.getElementById('heatmap-area-completed').textContent = completed;
    document.getElementById('heatmap-area-total').textContent = total;
    document.getElementById('heatmap-area-remaining').textContent = total - completed;
    infoPanel.style.display = 'block';
  }
}

// 地区情報パネル非表示
function hideAreaInfo() {
  const infoPanel = document.getElementById('heatmap-area-info-panel');
  if (infoPanel) {
    infoPanel.style.display = 'none';
  }
}

// 凡例作成
function createProgressLegend() {
  const legend = L.control({ position: 'bottomright' });
  
  legend.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'heatmap-legend');
    div.innerHTML = '<h4>進捗率</h4>';
    
    Object.values(PROGRESS_COLORS).forEach(colorInfo => {
      div.innerHTML += `
        <div class="legend-item">
          <i style="background: ${colorInfo.color}"></i>
          <span>${colorInfo.label}</span>
        </div>
      `;
    });
    
    return div;
  };
  
  return legend;
}

// 進捗パネル作成
function createProgressPanel() {
  const panel = L.control({ position: 'topright' });
  
  panel.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'heatmap-progress-panel');
    div.innerHTML = `
      <div class="heatmap-progress-title">発了率（全域）</div>
      <div class="heatmap-progress-value">
        <span id="heatmap-overall-progress">--</span>
        <span class="heatmap-progress-unit">%</span>
      </div>
    `;
    return div;
  };
  
  return panel;
}

// 地区情報パネル作成
function createAreaInfoPanel() {
  const panel = L.control({ position: 'topright' });
  
  panel.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'heatmap-area-info');
    div.id = 'heatmap-area-info-panel';
    div.style.display = 'none';
    div.innerHTML = `
      <div class="area-name" id="heatmap-area-name"></div>
      <div class="area-stats">
        進捗率: <strong id="heatmap-area-progress">0%</strong><br>
        完了: <span id="heatmap-area-completed">0</span>ヶ所<br>
        残り: <span id="heatmap-area-remaining">0</span>ヶ所<br>
        総数: <span id="heatmap-area-total">0</span>ヶ所
      </div>
    `;
    return div;
  };
  
  return panel;
}

// 表示モード切り替えボタン作成
function createDisplayModeControl() {
  const control = L.control({ position: 'topleft' });
  
  control.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'heatmap-mode-control leaflet-bar');
    div.innerHTML = `
      <button id="heatmap-pins-mode-btn" class="heatmap-mode-btn active" title="ピン表示">📍</button>
      <button id="heatmap-heatmap-mode-btn" class="heatmap-mode-btn" title="ヒートマップ">🗺️</button>
    `;
    
    // ボタンイベント
    div.querySelector('#heatmap-pins-mode-btn').onclick = function() {
      showPinsMode();
    };
    
    div.querySelector('#heatmap-heatmap-mode-btn').onclick = function() {
      showHeatmapMode();
    };
    
    return div;
  };
  
  return control;
}

// ピンモード表示
function showPinsMode() {
  if (heatmapLayer) {
    map.removeLayer(heatmapLayer);
  }
  
  // 既存のオーバーレイを表示
  Object.values(overlays).forEach(layer => {
    if (map.hasLayer(layer)) return;
    map.addLayer(layer);
  });
  
  hideAreaInfo();
  currentDisplayMode = 'pins';
  
  // ボタン状態更新
  document.querySelectorAll('.heatmap-mode-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('heatmap-pins-mode-btn').classList.add('active');
}

// ヒートマップモード表示
async function showHeatmapMode() {
  try {
    // 既存のオーバーレイを非表示
    Object.values(overlays).forEach(layer => {
      map.removeLayer(layer);
    });
    
    // 既存のヒートマップレイヤーを削除
    if (heatmapLayer) {
      map.removeLayer(heatmapLayer);
    }
    
    // ローディング表示
    console.log('ヒートマップデータ作成中...');
    
    // ヒートマップデータ作成
    const heatmapData = await createProgressHeatmap(allBoardPins);
    
    // ヒートマップレイヤー作成
    heatmapLayer = L.geoJSON(heatmapData, {
      style: getHeatmapStyle,
      onEachFeature: onEachHeatmapFeature
    });
    
    heatmapLayer.addTo(map);
    
    // 全体進捗率更新
    updateOverallProgress();
    
    currentDisplayMode = 'heatmap';
    
    // ボタン状態更新
    document.querySelectorAll('.heatmap-mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('heatmap-heatmap-mode-btn').classList.add('active');
    
    console.log('ヒートマップ表示完了');
    
  } catch (error) {
    console.error('ヒートマップ表示エラー:', error);
    alert('ヒートマップの表示中にエラーが発生しました');
  }
}

// 全体進捗率更新
function updateOverallProgress() {
  if (!allBoardPins) return;
  
  const completed = allBoardPins.filter(pin => pin.status === 1).length;
  const total = allBoardPins.length;
  const overallProgress = total > 0 ? (completed / total * 100) : 0;
  
  const progressElement = document.getElementById('heatmap-overall-progress');
  if (progressElement) {
    progressElement.textContent = Math.round(overallProgress * 10) / 10;
  }
}

// ===== 既存コード続き =====

async function loadBoardPins(pins, layer, status=null) {
  const areaList = await getAreaList();
  if (status != null) {
    pins = pins.filter(item => item.status == status);
  }
  pins.forEach(pin => {
    var marker = L.circleMarker([pin.lat, pin.long], {
      radius: 8,
      color: 'black',
      weight: 1,
      fillColor: `${getStatusColor(pin.status)}`,
      fillOpacity: 0.9,
      border: 1,
    })
    .addTo(layer);
    marker.bindPopup(`<b>${pin.name}</b><br>ステータス: ${getStatusText(pin.status)}<br>備考: ${getPinNote(pin.note)}<br>座標: <a href="https://www.google.com/maps/search/${pin.lat},+${pin.long}" target="_blank" rel="noopener noreferrer">(${pin.lat}, ${pin.long})</a>`);
  });
}

// 荒川区の町丁目境界線を読み込む関数
async function loadArakawaBoundaries() {
  try {
    const areaList = await getAreaList();
    
    // 荒川区の町名リスト（実際の町名に基づく）
    const arakawaAreas = [
      { name: '荒川', cho_max: 8 },
      { name: '町屋', cho_max: 8 },
      { name: '東尾久', cho_max: 9 },
      { name: '西尾久', cho_max: 8 },
      { name: '東日暮里', cho_max: 6 },
      { name: '西日暮里', cho_max: 6 },
      { name: '南千住', cho_max: 8 }
    ];

    for (const area of arakawaAreas) {
      for (let cho = 1; cho <= area.cho_max; cho++) {
        const geoJsonUrl = `https://uedayou.net/loa/東京都荒川区${area.name}${cho}丁目.geojson`;
        
        try {
          const response = await fetch(geoJsonUrl);
          if (!response.ok) continue;
          
          const data = await response.json();
          const polygon = L.geoJSON(data, {
            color: '#333333',
            fillColor: 'rgba(200, 200, 200, 0.15)',
            fillOpacity: 0.3,
            weight: 2.5,
            interactive: false,  // クリックイベントを無効化
          });
          
          polygon.addTo(map);
        } catch (error) {
          console.warn(`Failed to load ${area.name}${cho}丁目:`, error);
        }
      }
    }
  } catch (error) {
    console.error('境界線読み込みエラー:', error);
  }
}

function onLocationError(e) {
  // alert(e.message);
  const mapConfig = {
    'arakawa': {
      'lat': 35.7368,
      'long': 139.7832,
      'zoom': 14,
    },
    '23-west': {
      'lat': 35.6861171,
      'long': 139.6490942,
      'zoom': 13,
    },
    '23-city': {
      'lat': 35.6916896,
      'long': 139.7254559,
      'zoom': 14,
    },
    'tama-north': {
      'lat': 35.731028, 
      'long': 139.481822,
      'zoom': 13,
    },
    'tama-south': {
      'lat': 35.6229399,
      'long': 139.4584664,
      'zoom': 13,
    },
    'tama-west': {
      'lat': 35.7097579, 
      'long': 139.2904051,
      'zoom': 12,
    },
    'island': {
      'lat': 34.5291416,
      'long': 139.2819004,
      'zoom': 11,
    },
  }
  const block = getBlockFromUrlParam()
  let latlong, zoom;
  if (block == null) {
    latlong = [35.7368, 139.7832],  // デフォルトも荒川区に設定
    zoom = 14
  } else {
    latlong = [mapConfig[block]['lat'], mapConfig[block]['long']]
    zoom = mapConfig[block]['zoom']
  }
  map.setView(latlong, zoom);
}

const baseLayers = {
  'OpenStreetMap': osm,
  'Google Map': googleMap,
  '国土地理院地図': japanBaseMap,
};

const overlays = {
  '未':  L.layerGroup(),
  '完了':  L.layerGroup(),
  '異常':  L.layerGroup(),
  '要確認':  L.layerGroup(),
  '異常対応中':  L.layerGroup(),
  '削除':  L.layerGroup(),
  '期日前投票所':  L.layerGroup(),
};

// 現在地マーカー用変数
let currentLocationMarker = null;

// 現在地アイコンの定義
const currentLocationIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="blue" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3" fill="blue"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

// 現在地を取得して表示
function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert('このブラウザでは位置情報がサポートされていません');
    return;
  }
  
  console.log('現在地を取得中...');
  
  navigator.geolocation.getCurrentPosition(
    function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      
      console.log(`現在地: ${lat}, ${lng} (誤差: ${accuracy}m)`);
      
      // 既存のマーカーを削除
      if (currentLocationMarker) {
        map.removeLayer(currentLocationMarker);
      }
      
      // 現在地マーカーを追加
      currentLocationMarker = L.marker([lat, lng], {
        icon: currentLocationIcon
      }).addTo(map);
      
      currentLocationMarker.bindPopup(`
        <b>📍 現在地</b><br>
        緯度: ${lat.toFixed(6)}<br>
        経度: ${lng.toFixed(6)}<br>
        精度: ${accuracy.toFixed(0)}m<br>
        <small>${new Date().toLocaleTimeString()}</small>
      `);
      
      // 現在地を中心に移動
      map.setView([lat, lng], 16);
      
    },
    function(error) {
      console.error('位置情報取得エラー:', error);
      
      let errorMessage = '';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = '位置情報の利用が拒否されました。\n\nブラウザの設定で位置情報を許可してください。';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = '位置情報を取得できませんでした。\n\nGPS信号の良い場所で再試行してください。';
          break;
        case error.TIMEOUT:
          errorMessage = '位置情報の取得がタイムアウトしました。\n\nしばらく待ってから再試行してください。';
          break;
        default:
          errorMessage = '位置情報の取得中にエラーが発生しました。';
          break;
      }
      
      alert(errorMessage);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000  // 5分間キャッシュ
    }
  );
}

// 現在地ボタンを追加
const locationControl = L.Control.extend({
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    
    const locationBtn = L.DomUtil.create('button', '', container);
    locationBtn.innerHTML = '📍';
    locationBtn.style.backgroundColor = 'white';
    locationBtn.style.border = '2px solid rgba(0,0,0,0.2)';
    locationBtn.style.width = '40px';
    locationBtn.style.height = '40px';
    locationBtn.style.fontSize = '18px';
    locationBtn.style.cursor = 'pointer';
    locationBtn.style.borderRadius = '4px';
    locationBtn.title = '現在地を表示';
    
    locationBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      getCurrentLocation();
    });
    
    return container;
  }
});

var map = L.map('map', {
  layers: [
    overlays['未'],
    overlays['完了'],
    overlays['要確認'],
    overlays['異常'],
    overlays['異常対応中'],
    overlays['削除'],
    overlays['期日前投票所']
  ],
  preferCanvas:true,
});
osm.addTo(map);
const layerControl = L.control.layers(baseLayers, overlays).addTo(map);

// 現在地ボタンを地図に追加
map.addControl(new locationControl({ position: 'topleft' }));

// ===== ヒートマップ用コントロール追加 =====
let progressLegend, progressPanel, areaInfoPanel, displayModeControl;

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

// 荒川区の地図を確実に表示
setTimeout(() => map.setView([35.7368, 139.7832], 14), 100);

const block = getBlockFromUrlParam()
const smallBlock= getSmallBlockFromUrlParam()
let allBoardPins;

// 掲示板ピンの読み込み
getBoardPins(block, smallBlock).then(function(pins) {
  allBoardPins = pins
  loadBoardPins(allBoardPins, overlays['削除'], 6);
  loadBoardPins(allBoardPins, overlays['完了'], 1);
  loadBoardPins(allBoardPins, overlays['異常'], 2);
  loadBoardPins(allBoardPins, overlays['要確認'], 4);
  loadBoardPins(allBoardPins, overlays['異常対応中'], 5);
  loadBoardPins(allBoardPins, overlays['未'], 0);
  
  // ヒートマップ用UIコントロール追加
  if (block === 'arakawa') {
    progressLegend = createProgressLegend().addTo(map);
    progressPanel = createProgressPanel().addTo(map);
    areaInfoPanel = createAreaInfoPanel().addTo(map);
    displayModeControl = createDisplayModeControl().addTo(map);
    
    // 初期全体進捗率計算
    updateOverallProgress();
  }
});

// 進捗表示
Promise.all([getProgress(), getProgressCountdown()]).then(function(res) {
  progress = res[0];
  progressCountdown = res[1];
  progressBox((progress['total']*100).toFixed(2), 'topleft').addTo(map)
  progressBoxCountdown((parseInt(progressCountdown['total'])), 'topleft').addTo(map)
}).catch((error) => {
  console.error('Error in fetching data:', error);
});

// 期日前投票所とarakawa境界線の読み込み
loadVoteVenuePins(overlays['期日前投票所']);

// 荒川区が指定された場合のみ境界線を表示
if (block === 'arakawa') {
  loadArakawaBoundaries();
}
