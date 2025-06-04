let selectedAreas = new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]); // 初期状態で全選択
let isAreaSelectorExpanded = false;

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
  // 現在使用中: 0(未), 1(完了), 4(要確認)
  // 非表示中: 2(異常), 3(予約), 5(異常対応中), 6(削除)
  statusDict = {0: "未", 1: "完了", 2: "異常", 3: "予約", 4: "要確認", 5: "異常対応中", 6: "削除"}
  return statusDict[status] || "不明"  // 未定義ステータスの安全策
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

// ========================
// エリア選択機能
// ========================

// エリア選択コントロールを作成
function areaSelectBox(position) {
  var control = L.control({position: position});
  control.onAdd = function () {
    var div = L.DomUtil.create('div', 'info area-select');
    
    // ヘッダー部分（常に表示）
    var header = L.DomUtil.create('div', 'area-select-header', div);
    header.innerHTML = `
      <p style="margin: 0 0 2px 0; font-weight: bold;">エリア選択</p>
      <p style="margin: 0; font-size: 12px;" id="selected-count">選択中: 0個</p>
    `;
    
    // 展開/折りたたみボタン
    var toggleBtn = L.DomUtil.create('button', 'area-toggle-btn', div);
    toggleBtn.innerHTML = '▼';
    toggleBtn.style.cssText = `
      width: 100%; 
      margin-top: 5px; 
      padding: 4px; 
      border: 1px solid #ccc; 
      background: #f9f9f9; 
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
    `;
    
    // エリアボタンコンテナ（展開時に表示）
    var areaContainer = L.DomUtil.create('div', 'area-buttons-container', div);
    areaContainer.style.cssText = `
      display: none; 
      margin-top: 5px; 
      max-height: 200px; 
      overflow-y: auto;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 5px;
      background: white;
    `;
    
    // 全選択/全解除ボタン（エリアボタンの上に配置）
    var controlBtns = L.DomUtil.create('div', 'area-control-btns', areaContainer);
    controlBtns.style.cssText = 'margin-bottom: 5px; text-align: center;';
    
    var selectAllBtn = L.DomUtil.create('button', '', controlBtns);
    selectAllBtn.innerHTML = '全選択';
    selectAllBtn.style.cssText = `
      margin-right: 5px; 
      padding: 4px 8px; 
      border: 1px solid #007cba; 
      background: #007cba; 
      color: white; 
      cursor: pointer;
      border-radius: 3px;
      font-size: 11px;
    `;
    
    var clearAllBtn = L.DomUtil.create('button', '', controlBtns);
    clearAllBtn.innerHTML = '全解除';
    clearAllBtn.style.cssText = `
      padding: 4px 8px; 
      border: 1px solid #dc3545; 
      background: #dc3545; 
      color: white; 
      cursor: pointer;
      border-radius: 3px;
      font-size: 11px;
    `;
    
    // 32個のエリアボタンを生成
    for (let i = 1; i <= 32; i++) {
      var areaBtn = L.DomUtil.create('button', 'area-btn', areaContainer);
      areaBtn.innerHTML = i;
      areaBtn.dataset.area = i;
      areaBtn.style.cssText = `
        width: 22%; 
        margin: 1%; 
        padding: 6px 2px; 
        border: 1px solid #ccc; 
        background: white; 
        cursor: pointer;
        border-radius: 3px;
        font-size: 11px;
        display: inline-block;
      `;
      
      // エリアボタンクリック処理
      areaBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleAreaSelection(parseInt(this.dataset.area), this);
      });
    }
    
    // イベントリスナー
    toggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleAreaSelector(areaContainer, toggleBtn);
    });
    
    selectAllBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      selectAllAreas();
    });
    
    clearAllBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      clearAllAreas();
    });
    
    // マップクリック時に折りたたみ
    L.DomEvent.disableClickPropagation(div);
    
    return div;
  };
  return control;
}

// エリアセレクターの展開/折りたたみ
function toggleAreaSelector(container, toggleBtn) {
  isAreaSelectorExpanded = !isAreaSelectorExpanded;
  if (isAreaSelectorExpanded) {
    container.style.display = 'block';
    toggleBtn.innerHTML = '▲';
  } else {
    container.style.display = 'none';
    toggleBtn.innerHTML = '▼';
  }
}

// エリア選択の切り替え
function toggleAreaSelection(areaNum, btnElement) {
  if (selectedAreas.has(areaNum)) {
    selectedAreas.delete(areaNum);
    btnElement.style.background = 'white';
    btnElement.style.color = 'black';
    btnElement.style.borderColor = '#ccc';
  } else {
    selectedAreas.add(areaNum);
    btnElement.style.background = '#007cba';
    btnElement.style.color = 'white';
    btnElement.style.borderColor = '#007cba';
  }
  updateSelectedCount();
  filterPinsBySelectedAreas();
}

// 全選択
function selectAllAreas() {
  selectedAreas.clear();
  for (let i = 1; i <= 32; i++) {
    selectedAreas.add(i);
  }
  updateAreaButtonStyles();
  updateSelectedCount();
  filterPinsBySelectedAreas();
}

// 全解除
function clearAllAreas() {
  selectedAreas.clear();
  updateAreaButtonStyles();
  updateSelectedCount();
  filterPinsBySelectedAreas();
}

// ボタンスタイル更新
function updateAreaButtonStyles() {
  document.querySelectorAll('.area-btn').forEach(btn => {
    const areaNum = parseInt(btn.dataset.area);
    if (selectedAreas.has(areaNum)) {
      btn.style.background = '#007cba';
      btn.style.color = 'white';
      btn.style.borderColor = '#007cba';
    } else {
      btn.style.background = 'white';
      btn.style.color = 'black';
      btn.style.borderColor = '#ccc';
    }
  });
}

// 選択数表示更新
function updateSelectedCount() {
  const countElement = document.getElementById('selected-count');
  if (countElement) {
    countElement.textContent = `選択中: ${selectedAreas.size}個`;
  }
}

// 折りたたみ可能な進捗表示を作成
function collapsibleProgressBox(progressValue, countdownValue, position) {
  var control = L.control({position: position});
  control.onAdd = function () {
    var div = L.DomUtil.create('div', 'info progress-collapsible');
    
    // 折りたたみボタン
    var toggleBtn = L.DomUtil.create('button', 'progress-toggle-btn', div);
    toggleBtn.innerHTML = '📊';
    toggleBtn.style.cssText = `
      width: 100%; 
      padding: 4px; 
      border: 1px solid #ccc; 
      background: #f9f9f9; 
      cursor: pointer;
      border-radius: 3px;
      font-size: 14px;
      margin-bottom: 3px;
    `;
    
    // 進捗内容（展開時に表示）
    var contentDiv = L.DomUtil.create('div', 'progress-content', div);
    contentDiv.style.cssText = 'display: block;';
    contentDiv.innerHTML = `
      <p style="margin: 0 0 2px 0; font-weight: bold; font-size: 11px;">完了率</p>
      <p style="margin: 0 0 5px 0;"><span class="progressValue" style="font-size: 18px;">${progressValue}</span><span style="font-size: 11px;">%</span></p>
      <p style="margin: 0 0 2px 0; font-weight: bold; font-size: 11px;">残り</p>
      <p style="margin: 0;"><span class="progressValue" style="font-size: 18px;">${countdownValue}</span><span style="font-size: 11px;">ヶ所</span></p>
    `;
    
    // 折りたたみイベント
    let isExpanded = true;
    toggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (isExpanded) {
        contentDiv.style.display = 'none';
        toggleBtn.innerHTML = '📊';
      } else {
        contentDiv.style.display = 'block';
        toggleBtn.innerHTML = '📊';
      }
      isExpanded = !isExpanded;
    });
    
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  return control;
}

// 選択されたエリアでピンをフィルタリング
function filterPinsBySelectedAreas() {
  // 全レイヤーをクリア
  Object.values(overlays).forEach(layer => {
    layer.clearLayers();
  });
  
  // フィルタリング実行
  let filteredPins = [];
  
  if (selectedAreas.size > 0) {
    filteredPins = allBoardPins.filter(pin => {
      const areaNum = parseInt(pin.name.split('-')[0]);
      return selectedAreas.has(areaNum);
    });
  }
  // selectedAreas.size が 0 の場合は filteredPins は空配列のまま（何も表示しない）
  
  // フィルタリング後のピンを再描画
  loadBoardPins(filteredPins, overlays['完了'], 1);
  loadBoardPins(filteredPins, overlays['要確認'], 4);
  loadBoardPins(filteredPins, overlays['未'], 0);
}

// ========================
// 地図とレイヤー設定
// ========================

const baseLayers = {
  'OpenStreetMap': osm,
  'Google Map': googleMap,
  '国土地理院地図': japanBaseMap,
};

const overlays = {
  '未':  L.layerGroup(),
  '完了':  L.layerGroup(),
  '要確認':  L.layerGroup(),
};

// ========================
// 地図初期化とデータ読み込み
// ========================

var map = L.map('map', {
  layers: [
    overlays['未'],
    overlays['完了'],
    overlays['要確認']
  ],
  preferCanvas:true,
});
osm.addTo(map);
const layerControl = L.control.layers(baseLayers, overlays).addTo(map);

map.on('locationerror', onLocationError);

// 荒川区の地図を確実に表示
setTimeout(() => map.setView([35.7368, 139.7832], 14), 100);

const block = getBlockFromUrlParam()
const smallBlock= getSmallBlockFromUrlParam()
let allBoardPins;

// 掲示板ピンの読み込み（エリア選択機能付き）
getBoardPins(block, smallBlock).then(function(pins) {
  allBoardPins = pins;
  
  // 初期ピン表示（全て表示）
  loadBoardPins(allBoardPins, overlays['完了'], 1);
  loadBoardPins(allBoardPins, overlays['要確認'], 4);
  loadBoardPins(allBoardPins, overlays['未'], 0);
  
  // エリア選択コントロールを追加（右上の進捗表示の下）
  const areaControl = areaSelectBox('topright').addTo(map);
  
  // 初期状態を正しく反映（全選択状態）
  setTimeout(() => {
    updateSelectedCount();
    updateAreaButtonStyles();
  }, 100);
});

// 進捗表示（折りたたみ式）
Promise.all([getProgress(), getProgressCountdown()]).then(function(res) {
  progress = res[0];
  progressCountdown = res[1];
  collapsibleProgressBox((progress['total']*100).toFixed(2), parseInt(progressCountdown['total']), 'bottomleft').addTo(map);
}).catch((error) => {
  console.error('Error in fetching data:', error);
});

// 荒川区が指定された場合のみ境界線を表示
if (block === 'arakawa') {
  loadArakawaBoundaries();
}
