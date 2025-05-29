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
japanBaseMap.addTo(map);
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

// 掲示板ピンの読み込み
getBoardPins(block, smallBlock).then(function(pins) {
  allBoardPins = pins
  loadBoardPins(allBoardPins, overlays['削除'], 6);
  loadBoardPins(allBoardPins, overlays['完了'], 1);
  loadBoardPins(allBoardPins, overlays['異常'], 2);
  loadBoardPins(allBoardPins, overlays['要確認'], 4);
  loadBoardPins(allBoardPins, overlays['異常対応中'], 5);
  loadBoardPins(allBoardPins, overlays['未'], 0);
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
