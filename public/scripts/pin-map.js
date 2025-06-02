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
      // 追加：ピン専用paneに配置
      pane: 'pinPane'
    })
    .addTo(layer);
    marker.bindPopup(`<b>${pin.name}</b><br>ステータス: ${getStatusText(pin.status)}<br>備考: ${getPinNote(pin.note)}<br>座標: <a href="https://www.google.com/maps/search/${pin.lat},+${pin.long}" target="_blank" rel="noopener noreferrer">(${pin.lat}, ${pin.long})</a>`);
  });
}

// ===== 進捗ヒートマップ機能 =====

// ポスティングマップから流用：色分けロジック
function getProgressColor(percentage) {
    const colorStops = [
        { pct: 0.0, color: { r: 227, g: 250, b: 254 } },
        { pct: 0.25, color: { r: 210, g: 237, b: 253 } },
        { pct: 0.5, color: { r: 115, g: 197, b: 251 } },
        { pct: 0.75, color: { r: 66, g: 176, b: 250 } },
        { pct: 0.999, color: { r: 12, g: 153, b: 247 } },
        { pct: 1.0, color: { r: 4, g: 97, b: 159 } }
    ];

    percentage = Math.max(0, Math.min(1, percentage));

    let lower = colorStops[0];
    let upper = colorStops[colorStops.length - 1];

    for (let i = 1; i < colorStops.length; i++) {
        if (percentage <= colorStops[i].pct) {
            upper = colorStops[i];
            lower = colorStops[i - 1];
            break;
        }
    }

    const rangePct = (percentage - lower.pct) / (upper.pct - lower.pct);
    const r = Math.round(lower.color.r + rangePct * (upper.color.r - lower.color.r));
    const g = Math.round(lower.color.g + rangePct * (upper.color.g - lower.color.g));
    const b = Math.round(lower.color.b + rangePct * (upper.color.b - lower.color.b));

    return `rgb(${r}, ${g}, ${b})`;
}

// GeoJSONスタイル
function getBoardGeoJsonStyle(progress) {
  return {
    color: 'black',
    fillColor: getProgressColor(progress),
    fillOpacity: 0.7,
    weight: 2,
    pane: 'heatmapPane'
  }
}

// 凡例
function boardLegend() {
  var control = L.control({position: 'bottomright'});
  control.onAdd = function () {
      var div = L.DomUtil.create('div', 'info legend')
      grades = [1, 0.75, 0.5, 0.25, 0]

      div.innerHTML += '<p>進捗率</p>';

      var legendInnerContainerDiv = L.DomUtil.create('div', 'legend-inner-container', div);
      legendInnerContainerDiv.innerHTML += '<div class="legend-gradient"></div>';

      var labelsDiv = L.DomUtil.create('div', 'legend-labels', legendInnerContainerDiv);
      for (var i = 0; i < grades.length; i++) {
        labelsDiv.innerHTML += '<span>' + grades[i] * 100 + '%</span>';
      }
      labelsDiv.innerHTML += '<span>未着手</span>'
      return div;
  };

  return control
}

// 進捗計算（デバッグ付き）
function extractAreaNameFromPin(pinName) {
  const parts = pinName.split('-');
  const areaName = parts[0] || 'その他';
  return areaName;
}

function calculateAreaProgress(pins, areaName) {
  console.log(`=== ${areaName} の進捗計算開始 ===`);
  console.log(`全ピン数: ${pins ? pins.length : 0}`);
  
  if (!pins || pins.length === 0) {
    console.log(`${areaName}: ピンデータなし`);
    return 0;
  }
  
  // サンプルピンの内容確認
  if (pins.length > 0) {
    console.log('サンプルピン:', pins[0]);
    console.log('サンプルピン名:', pins[0].name);
    console.log('抽出された地区名:', extractAreaNameFromPin(pins[0].name));
  }
  
  const areaPins = pins.filter(pin => {
    const pinAreaName = extractAreaNameFromPin(pin.name);
    return pinAreaName === areaName;
  });
  
  console.log(`${areaName}のピン数: ${areaPins.length}`);
  
  if (areaPins.length === 0) {
    console.log(`${areaName}: 該当ピンなし`);
    return 0;
  }
  
  const completed = areaPins.filter(pin => pin.status === 1).length;
  const progress = completed / areaPins.length;
  
  console.log(`${areaName}: 完了 ${completed}/${areaPins.length} = ${(progress * 100).toFixed(1)}%`);
  console.log(`${areaName}の色: ${getProgressColor(progress)}`);
  
  return progress;
}

// 進捗ヒートマップ対応版：荒川区の町丁目境界線を読み込む関数
async function loadArakawaBoundaries() {
  try {
    console.log('=== 掲示板進捗ヒートマップ読み込み開始 ===');
    console.log('allBoardPins:', allBoardPins ? `${allBoardPins.length}件` : 'undefined');
    
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

    let successCount = 0;

    for (const area of arakawaAreas) {
      for (let cho = 1; cho <= area.cho_max; cho++) {
        const areaName = `${area.name}${cho}丁目`;
        const geoJsonUrl = `https://uedayou.net/loa/東京都荒川区${areaName}.geojson`;
        
        try {
          const response = await fetch(geoJsonUrl);
          if (!response.ok) {
            console.warn(`${areaName}: ${response.status}`);
            continue;
          }
          
          const data = await response.json();
          
          // 進捗率計算（掲示板データから）
          const progressValue = allBoardPins ? calculateAreaProgress(allBoardPins, areaName) : 0;
          console.log(`${areaName}: 最終進捗率 = ${(progressValue * 100).toFixed(1)}%`);
          
          // ポリゴン作成（ポスティングマップと同じスタイル）
          const polygon = L.geoJSON(data, {
            style: getBoardGeoJsonStyle(progressValue)
          });
          
          // ポップアップ内容
          const completedCount = allBoardPins ? 
            allBoardPins.filter(pin => extractAreaNameFromPin(pin.name) === areaName && pin.status === 1).length : 0;
          const totalCount = allBoardPins ? 
            allBoardPins.filter(pin => extractAreaNameFromPin(pin.name) === areaName).length : 0;
          
          const popupContent = `
            <b>${areaName}</b><br>
            掲示板進捗: ${(progressValue * 100).toFixed(1)}%<br>
            完了: ${completedCount}ヶ所<br>
            残り: ${totalCount - completedCount}ヶ所<br>
            総数: ${totalCount}ヶ所
          `;
          
          polygon.bindPopup(popupContent);
          polygon.addTo(map);
          
          successCount++;
          
        } catch (error) {
          console.warn(`${areaName}: ${error.message}`);
        }
        
        // サーバー負荷軽減
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`=== ヒートマップ読み込み完了: ${successCount}件 ===`);
    
  } catch (error) {
    console.error('ヒートマップ読み込みエラー:', error);
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
  iconUrl: 'data:image/svg+xml;base64=' + btoa(`
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

// カスタムpane作成でレイヤー順序を制御
map.createPane('heatmapPane');
map.getPane('heatmapPane').style.zIndex = 200; // 背景レイヤー

map.createPane('pinPane');
map.getPane('pinPane').style.zIndex = 650; // 前景レイヤー

osm.addTo(map);
const layerControl = L.control.layers(baseLayers, overlays).addTo(map);

// 現在地ボタンを地図に追加
map.addControl(new locationControl({ position: 'topleft' }));

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

// 荒川区の地図を確実に表示
setTimeout(() => map.setView([35.7368, 139.7832], 14), 100);

const block = getBlockFromUrlParam()
const smallBlock= getSmallBlockFromUrlParam()
let allBoardPins;

// 荒川区の場合は読み込み順序を調整
if (block === 'arakawa') {
  // 荒川区：データ読み込み後、ヒートマップ→ピンの順で描画
  getBoardPins(block, smallBlock).then(async function(pins) {
    console.log('=== 荒川区データ読み込み完了 ===');
    console.log('取得したピン数:', pins.length);
    
    allBoardPins = pins;
    
    // 少し待機してからヒートマップを描画
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 1. 先にヒートマップを描画（背景）
    console.log('ヒートマップ描画開始...');
    await loadArakawaBoundaries();
    
    // 2. 凡例を追加
    boardLegend().addTo(map);
    
    // 3. 後でピンを描画（前景、クリック可能）
    console.log('ピン描画開始...');
    loadBoardPins(allBoardPins, overlays['削除'], 6);
    loadBoardPins(allBoardPins, overlays['完了'], 1);
    loadBoardPins(allBoardPins, overlays['異常'], 2);
    loadBoardPins(allBoardPins, overlays['要確認'], 4);
    loadBoardPins(allBoardPins, overlays['異常対応中'], 5);
    loadBoardPins(allBoardPins, overlays['未'], 0);
    
    console.log('=== 荒川区表示完了 ===');
  });
} else {
  // その他の地域は従来通り
  getBoardPins(block, smallBlock).then(function(pins) {
    allBoardPins = pins
    loadBoardPins(allBoardPins, overlays['削除'], 6);
    loadBoardPins(allBoardPins, overlays['完了'], 1);
    loadBoardPins(allBoardPins, overlays['異常'], 2);
    loadBoardPins(allBoardPins, overlays['要確認'], 4);
    loadBoardPins(allBoardPins, overlays['異常対応中'], 5);
    loadBoardPins(allBoardPins, overlays['未'], 0);
  });
}

// 進捗表示
Promise.all([getProgress(), getProgressCountdown()]).then(function(res) {
  progress = res[0];
  progressCountdown = res[1];
  progressBox((progress['total']*100).toFixed(2), 'topleft').addTo(map)
  progressBoxCountdown((parseInt(progressCountdown['total'])), 'topleft').addTo(map)
}).catch((error) => {
  console.error('Error in fetching data:', error);
});

// 期日前投票所の読み込み
loadVoteVenuePins(overlays['期日前投票所']);
