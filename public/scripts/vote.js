function onLocationFound(e) {
  const radius = e.accuracy / 2;
  const locationMarker = L.marker(e.latlng).addTo(map)
    .bindPopup("現在地").openPopup();
  const locationCircle = L.circle(e.latlng, radius).addTo(map);
  map.setView(e.latlng, 14);
}

function onLocationError(e) {
  // 荒川区の中心座標に設定
  const latlong = [35.7368, 139.7832]
  const zoom = 14
  map.setView(latlong, zoom);
}

const baseLayers = {
  'OpenStreetMap': osm,
  'Google Map': googleMap,
  '国土地理院地図': japanBaseMap,
};

const overlays = {
  '期日前投票所':  L.layerGroup(),
};

var map = L.map('map', {
  layers: [
    overlays['期日前投票所']
  ],
  preferCanvas:true,
});
japanBaseMap.addTo(map);
const layerControl = L.control.layers(baseLayers, overlays).addTo(map);

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);
map.locate({setView: false, maxZoom: 14});

setTimeout(() => map.setView([35.7368, 139.7832], 14), 100);

// 荒川区のポリゴン表示（境界線）
Promise.all([getAreaList()]).then(function(res) {
  const areaList = res[0];
  
  // 荒川区のみ
  const arakawaInfo = areaList[7];
  if (arakawaInfo) {
    fetch(`https://uedayou.net/loa/東京都${arakawaInfo['area_name']}.geojson`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch geojson for ${arakawaInfo['area_name']}`);
        }
        return response.json();
      })
      .then((data) => {
        const polygon = L.geoJSON(data, {
          color: 'red',
          fillColor: "red",
          fillOpacity: 0.1,
          weight: 2,
        });
        polygon.addTo(map);
      })
      .catch((error) => {
        console.error('Error fetching geojson:', error);
      });
  }
}).catch((error) => {
  console.error('Error in fetching data:', error);
});

loadVoteVenuePins(overlays['期日前投票所']);
