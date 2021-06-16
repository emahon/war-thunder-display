// globals
let data = [];
let state = [];
var counter = 0;

let g = 9.8; // constant for gravity, TODO: What does Gaijin actually use?

// globals from gaijin
map_objects = null;
map_info = null;
map_image = new Image();
//map_image.src = '/map.img'

cookieLifeTime = 60*60*24*1000;

map_scale = 1.0;
map_pan = [0, 0];

prevMousePos = null;
prevScale = null;

lastT = null;
blinkNormalT = 0.0;
blinkHeavyT = 0.0;
blinkNormalVal = 0.0;
blinkHeavyVal = 0.0;

lastPlayerPos = null;
isDraggingMap = false;
isTransformingMap = false;

lastChatRecId = 0;
lastEvtMsgId = 0;
lastDmgMsgId = 0;

// get objects
setInterval(function() {
	fetch("http://localhost:8111/map_obj.json")
	  .then(response => {
		  return response.json();
	  })
	  .then(json => {
		  // gaijin code - ported from update_object_positions
		  map_objects = json
		  var dt = update_timers()
		  redraw_map(dt) 
	  })
	  .catch(error => {
		  // if this is a CORS error, then the user needs to get into
		  // a match
		  // show that!
      if (error.name === "SyntaxError") {
        return;
      }
		  console.log(error);
	  });
}, 50);

// get map info
setInterval(function() {
	fetch("http://localhost:8111/map_info.json")
	  .then(response => response.json())
		.then(json => {			
      var prevMapGen = (map_info && ('map_generation' in map_info)) ? map_info['map_generation'] : -1;
      var newMapGen = (json && ('map_generation' in json)) ? json['map_generation'] : -1;
    
			map_info = json;
			
			if (prevMapGen != newMapGen) {
				map_image.src = 'http://localhost:8111/map.img?gen='+newMapGen
				map_scale = 1.0
				map_pan = [0.0, 0.0]
				redraw_map(0.0)
			}
		})
		.catch(error => {
			console.log(error);
		});
}, 50);

// get chat
setInterval(function() {
  fetch('http://localhost:8111/gamechat?lastId='+lastChatRecId)
    .then(response => response.json())
    .then(json => {
      if (!json || !json.length) {
        return;
      }
      
      var root = $('#game-chat-root #textlines');
      for (var i=0; i<json.length; ++i) {
        add_to_chat(root, json[i]);
      }
      
      // change this - only want to scroll to bottom if new message
      root.get(0).scrollTop = root.get(0).scrollHeight;

      lastChatRecId = json[json.length-1].id;
    })
    .catch(error => {
      console.log(error);
    });
}, 50);

// get hud message
setInterval(function() {
  fetch('http://localhost:8111/hudmsg?lastEvt='+lastEvtMsgId+'&lastDmg='+lastDmgMsgId)
    .then(response => response.json())
    .then(json => {
      if (!json) {
        return;
      }
      
      var msgEvt = json["events"];
      var msgDmg = json["damage"];
      var types = [[msgEvt, '#hud-evt-msg-root #textlines'], [msgDmg, '#hud-dmg-msg-root #textlines']];
      for (var tp=0; tp<types.length; ++tp) {
        var msg = types[tp][0];
        var root = $(types[tp][1]);
        for (var i=0; i<msg.length; ++i) {
          add_to_chat(root, msg[i]);
        }
        root.get(0).scrollTop = root.get(0).scrollHeight;
      }

      if (msgEvt.length) {
        lastEvtMsgId = msgEvt[msgEvt.length-1].id;
      }
      if (msgDmg.length) {
        lastDmgMsgId = msgDmg[msgDmg.length-1].id;
      }
    })
    .catch(error => {
      console.log(error);
    });
}, 50);

// get indicators
setInterval(function () {
  fetch("http://localhost:8111/indicators")
    .then(response => response.json())
    .then(json => {
      data = json;
      // gaijin code - ported from update_indicators
      var isValid = data && data['valid']
      var roots = [$('#indicators0'), $('li')]
      for (var i=0; i<2; ++i) {
        if (isValid) { 
          roots[i].show() 
        } else { 
          roots[i].hide() 
        }
      }
      if (!isValid)
      return
      
      var lists = [$('#indicators0 li'), $('#indicators1 li')]
      for (var iList=0; iList<2; ++iList) {
        var list = lists[iList]
        for (var iItem=0, nItems=list.length; iItem < nItems; ++iItem) {
          var elem = $(list.get(iItem))
          var id = elem.get(0).id.slice(4)
          if (id in data) {
            elem.show()
            elem.text(id+'='+data[id])
          } else {
            elem.hide()
          }
        }
      }
	  
      // my code
      
      calc_energy(data, state);
    })
	  .catch(error => {
		  console.log(error);
	  });
}, 50);

// get state
setInterval(function () {
  fetch("http://localhost:8111/state")
    .then(response => response.json())
    .then(json => {
     state = json;
     // gaijin code - ported from update_state
     var isValid = json && json['valid']
        var roots = [$('#state0'), $('li')]
        for (var i=0; i<2; ++i) {
          if (isValid) { roots[i].show() } else { roots[i].hide() }
        }
        if (!isValid)
          return
          
        //alert('isValid')
          
        var lists = [$('#state0 li'), $('#state1 li')]
        for (var iList=0; iList<2; ++iList) {
          var list = lists[iList]
          for (var iItem=0, nItems=list.length; iItem < nItems; ++iItem) {
            var elem = $(list.get(iItem))
            var id = elem.get(0).id.slice(4)
            //alert('parameter id "' + id + '"')
            if (id in json) {
              elem.show()
              elem.text(id+'='+json[id])
            } else {
              //alert('parameter id "' + id + '" not found')
              elem.hide()
            }
          }
        }
     
     // my code
     calc_energy(data, state);
    })
	  .catch(error => {
		  console.log(error);
	  });
}, 50);

function calc_energy(data, state) {
  let energy_speed = (data.speed**2/2);
  let energy_height = (g*state["H, m"]);
  let energy = energy_speed + energy_height;
  document.getElementById("energy_speed").innerText = energy_speed.toFixed(0);
  document.getElementById("energy_height").innerText = energy_height.toFixed(0);
  document.getElementById("energy").innerText = energy.toFixed(0);
}

// code ported from gaijin

hammer_opt = {
  hold: false, tap:false, doubletap:false,
  drag:true, dragstart:true, dragend:true, dragup:false, dragdown:false, dragleft:false, dragright:false,
  swipe:false, swipeup:false, swipedown:false, swipeleft:false, swiperight:false,
  transform:true, transformstart:true, transformend:true, rotate:false,
  pinch:false, pinchin:false, pinchout:false, 
  /*touch:false, release:false,*/

  prevent_default: true,
  no_mouseevents: true
}

indicator_columns = [
  [
	'type', 'speed', 'speed_01', 'speed_02',
	'pedals', 'pedals0', 'pedals1', 'pedals2', 'pedals3', 'pedals4', 'pedals5', 'pedals6', 'pedals7', 'pedals8',
	'stick_elevator', 'stick_ailerons',
	'vario',
	'altitude_hour', 'altitude_min', 'altitude_10k', 'aviahorizon_roll', 'aviahorizon_pitch', 'aviahorizon_roll1', 'aviahorizon_pitch1',
	'bank', 'bank1', 'bank2', 'turn', 'turn1', 'turn2',
	'compass', 'compass1', 'compass2', 'compass3', 'compass4',
	'clock_hour', 'clock_min', 'clock_sec', 'g_meter',
	'manifold_pressure', 'manifold_pressure1', 'manifold_pressure2', 'manifold_pressure3',
	'head_temperature', 'head_temperature1', 'head_temperature2', 'head_temperature3',
	'mixture', 'mixture1', 'mixture2', 'mixture3',
	'oxygen',
	'gears', 'gears1', 'gears2', 'gears_lamp',
	'flaps', 'trimmer',
	'weapon1', 'weapon2', 'weapon3',
	'prop_pitch',
	'prop_pitch_hour', 'prop_pitch_hour1', 'prop_pitch_hour2', 'prop_pitch_hour3',
	'prop_pitch_min', 'prop_pitch_min1', 'prop_pitch_min2', 'prop_pitch_min3',
	'ammo_counter', 'ammo_counter1', 'ammo_counter2', 'ammo_counter3', 'ammo_counter4', 'ammo_counter5', 'ammo_counter6', 'ammo_counter7',
	'flaps_indicator', 'gears_indicator', 'radiator',
  ],
  [
	'rpm', 'rpm1', 'rpm2', 'rpm3', 'rpm_min', 'rpm1_min', 'rpm2_min', 'rpm3_min', 'rpm_hour', 'rpm1_hour', 'rpm2_hour', 'rpm3_hour',
	'oil_pressure', 'oil_pressure1', 'oil_pressure2', 'oil_pressure3',
	'oil_temperature', 'oil_temperature1', 'oil_temperature2', 'oil_temperature3',
	'water_temperature', 'water_temperature1', 'water_temperature2', 'water_temperature3',
	'carb_temperature', 'carb_temperature1', 'carb_temperature2', 'carb_temperature3',
	'fuel', 'fuel1', 'fuel2',
	'fuel_pressure', 'fuel_pressure1', 'fuel_pressure2', 'fuel_pressure3', 'fuel_consume',
	'throttle', 'throttle1', 'throttle2',
	'supercharger', 'supercharger1', 'supercharger2',
  ]
]

state_columns = [
  [
	'H, m', 'TAS, km/h', 'IAS, km/h', 'M', 'AoA, deg', 'AoS, deg', 'Ny', 'Vy, m/s', 'Wx, deg/s',
	'Mfuel, kg', 'Mfuel0, kg', 'Mfuel 1, kg', 'Mfuel0 1, kg', , 'Mfuel 2, kg', 'Mfuel0 2, kg',
	'aileron, %', 'elevator, %', 'rudder, %', 'flaps, %', 'gear, %', 'airbrake, %'
  ],
  [
	'throttle 1, %', 'RPM throttle 1, %', 'mixture 1, %', 'radiator 1, %', 'compressor stage 1', 'magneto 1', 'feathered 1', 'power 1, hp', 'RPM 1', 'manifold pressure 1, atm',
	  'water temp 1, C', 'oil temp 1, C', 'pitch 1, deg', 'thrust 1, kgs', 'efficiency 1, %',
	'throttle 2, %', 'RPM throttle 2, %', 'mixture 2, %', 'radiator 2, %', 'compressor stage 2', 'magneto 2', 'feathered 2', 'power 2, hp', 'RPM 2', 'manifold pressure 2, atm',
	  'water temp 2, C', 'oil temp 2, C', 'pitch 2, deg', 'thrust 2, kgs', 'efficiency 2, %',
	'throttle 3, %', 'RPM throttle 3, %', 'mixture 3, %', 'radiator 3, %', 'compressor stage 3', 'magneto 3', 'feathered 3', 'power 3, hp', 'RPM 3', 'manifold pressure 3, atm',
	  'water temp 3, C', 'oil temp 3, C', 'pitch 3, deg', 'thrust 3, kgs', 'efficiency 3, %',
	'throttle 4, %', 'RPM throttle 4, %', 'mixture 4, %', 'radiator 4, %', 'compressor stage 4', 'magneto 4', 'feathered 4', 'power 4, hp', 'RPM 4', 'manifold pressure 4, atm',
	  'water temp 4, C', 'oil temp 4, C', 'pitch 4, deg', 'thrust 4, kgs', 'efficiency 4, %'
  ]
]

function addWheelHandler(elem, onWheel) {
  if (elem.addEventListener) {
	if ('onwheel' in document) {
	  // IE9+, FF17+
	  elem.addEventListener("wheel", onWheel, false);
	} else if ('onmousewheel' in document) {
	  // obsolete version
	  elem.addEventListener("mousewheel", onWheel, false);
	} else {
	  // 3.5 <= Firefox < 17
	  elem.addEventListener("MozMousePixelScroll", onWheel, false);
	}
  } else { // IE<9
	elem.attachEvent("onmousewheel", onWheel);
  }
}

function clampMapPan() {
  var canvas = document.getElementById('map-canvas');
  map_pan[0] = clamp(map_pan[0], -(map_scale-1.0)*canvas.width, 0);
  map_pan[1] = clamp(map_pan[1], -(map_scale-1.0)*canvas.height, 0);
}


function mapOnWheel(e) {
  e = e || window.event;
  var delta = e.wheelDelta ? e.wheelDelta : (e.deltaY || e.detail)*-40;
  delta *= map_scale * 0.8;

  var offsX = (e.offsetX!=undefined) ? e.offsetX : (e.pageX-$('#map-canvas').offset().left);
  var offsY = (e.offsetY!=undefined) ? e.offsetY : (e.pageY-$('#map-canvas').offset().top);
  map_scale_new = clamp(map_scale + delta * 0.001, 1.0, 15.0);
  map_pan[0] = offsX - (offsX - map_pan[0])*map_scale_new / map_scale;
  map_pan[1] = offsY - (offsY - map_pan[1])*map_scale_new / map_scale;
  map_scale = map_scale_new;
  clampMapPan();

  redraw_map(0.0);

  e.preventDefault ? e.preventDefault() : (e.returnValue = false);
}

function on_touch_event(e) {
  if (!e.gesture) { // ???
	return
  }

  if (e.type == 'dragstart') {
	isDraggingMap = true;
  }
  else if (e.type == 'transformstart') {
	isTransformingMap = true;
  }
  else if (e.type == 'dragend') {
	isDraggingMap = false;
  }
  else if (e.type == 'transformend') {
	isTransformingMap = false;
  }
  else if (e.type == 'drag' || e.type == 'transform') {
	if (e.type == 'transform') {
	  scale0 = map_scale;
	  map_scale = clamp(map_scale * e.gesture.scale / prevScale, 1.0, 3.0);

	  // scale shift
	  var offsX = e.gesture.center.pageX - $('#map-canvas').offset().left;
	  var offsY = e.gesture.center.pageY - $('#map-canvas').offset().top;
	  map_pan[0] = offsX - (offsX - map_pan[0])*map_scale / scale0;
	  map_pan[1] = offsY - (offsY - map_pan[1])*map_scale / scale0;
	}

	// drag shift
	map_pan[0] += e.gesture.center.pageX - prevMousePos[0];
	map_pan[1] += e.gesture.center.pageY - prevMousePos[1];

	clampMapPan();
	redraw_map(0.0);
  } else {
	console.log('Unexpected event type');
	console.log(e);
	return;
  }
  
  prevMousePos = [e.gesture.center.pageX, e.gesture.center.pageY];
  prevScale = e.gesture.scale;
}

function calcMapObjectColor(item) {
  if (('blink' in item) && (item['blink'])) {
	var bv = (item['blink']==2 ? blinkHeavyVal : blinkNormalVal);

	var c0 = item['color[]'];
	var c1 = [255, 255, 0];
	var c = rgb_to_hex(Math.floor(lerp(c0[0], c1[0], bv)), Math.floor(lerp(c0[1], c1[1], bv)), Math.floor(lerp(c0[2], c1[2], bv)));
	return c;
  } else {
	return item['color'];
  }
}

function drawMapGrid(canvas) {
  if (!map_info || !('map_min' in map_info))
	return

  var ctx = canvas.getContext('2d')
  var w = canvas.width
  var h = canvas.height
  var mapMin = map_info['map_min']
  var mapMax = map_info['map_max']
  var scX = w / (mapMax[0] - mapMin[0])
  var scY = h / (mapMax[1] - mapMin[1])

  ctx.lineWidth = 1
  ctx.strokeStyle = '#555'

  ctx.beginPath()
  for (var y = mapMin[1]; y <= mapMax[1]; y += map_info['grid_steps'][1]) {
	var yy = Math.floor((y-mapMin[1])*scY)+0.5
	ctx.moveTo(0, yy)
	ctx.lineTo(w, yy)
  }
  for (var x = mapMin[0]; x <= mapMax[0]; x += map_info['grid_steps'][0]) {
	var xx = Math.floor((x-mapMin[0])*scX)+0.5
	ctx.moveTo(xx, 0)
	ctx.lineTo(xx, h)
  }
  ctx.stroke()

  ctx.fillStyle = '#111'
  ctx.font = 'normal 9pt sans-serif'

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  for (var y = mapMin[1]+map_info['grid_steps'][1]*0.5, n=0; y <= mapMax[1] && n < 26; y += map_info['grid_steps'][1], ++n) {
	var yy = Math.floor((y-mapMin[1])*scY)+0.5
	ctx.fillText(String.fromCharCode(65+n), 3, yy)
  }

  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  for (var x = mapMin[0]+map_info['grid_steps'][0]*0.5, n=1; x <= mapMax[0]; x += map_info['grid_steps'][0], ++n) {
	var xx = Math.floor((x-mapMin[0])*scX)+0.5
	ctx.fillText(n, xx, 3)
  }
}


function drawMapGridScaled(canvas) {
  if (!map_info || !('map_min' in map_info))
	return

  var ctx = canvas.getContext('2d')
  var w = canvas.width
  var h = canvas.height
  var mapMin = map_info['map_min']
  var mapMax = map_info['map_max']
  var gridSteps = map_info['grid_steps']
  var scX = w * map_scale / (mapMax[0] - mapMin[0])
  var scY = h * map_scale / (mapMax[1] - mapMin[1])

  var firstVisCellX = Math.floor((-map_pan[0] / scX) / gridSteps[0])
  var firstVisCellY = Math.floor((-map_pan[1] / scY) / gridSteps[1])
  var xVis0 = mapMin[0] + firstVisCellX * gridSteps[0]
  var yVis0 = mapMin[1] + firstVisCellY * gridSteps[1]
  var xVis1 = mapMin[0] + Math.ceil((w-map_pan[0]) / scX / gridSteps[0]) * gridSteps[0]
  var yVis1 = mapMin[1] + Math.ceil((h-map_pan[1]) / scY / gridSteps[1]) * gridSteps[1]

  ctx.lineWidth = 1
  ctx.strokeStyle = '#555'

  ctx.beginPath()
  for (var y = yVis0; y <= yVis1; y += gridSteps[1]) {
	var yy = Math.floor((y-mapMin[1])*scY+map_pan[1])+0.5
	ctx.moveTo(0, yy)
	ctx.lineTo(w, yy)
  }
  for (var x = xVis0; x <= xVis1; x += gridSteps[0]) {
	var xx = Math.floor((x-mapMin[0])*scX+map_pan[0])+0.5
	ctx.moveTo(xx, 0)
	ctx.lineTo(xx, h)
  }
  ctx.stroke()

  ctx.fillStyle = '#111'
  ctx.font = 'normal 9pt sans-serif'

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  for (var y = yVis0+map_info['grid_steps'][1]*0.5, n=firstVisCellY; y <= yVis1 && n < 26; y += gridSteps[1], ++n) {
	var yy = Math.floor((y-mapMin[1])*scY+map_pan[1])+0.5
	ctx.fillText(String.fromCharCode(65+n), 3, yy)
  }

  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  for (var x = xVis0+map_info['grid_steps'][0]*0.5, n=firstVisCellX; x <= xVis1; x += gridSteps[0], ++n) {
	var xx = Math.floor((x-mapMin[0])*scX+map_pan[0])+0.5
	ctx.fillText(n+1, xx, 3)
  }
}


function draw_airfield(canvas, ctx, item) {
  var sx = canvas.width *item['sx']*map_scale + map_pan[0]
  var sy = canvas.height*item['sy']*map_scale + map_pan[1]
  var ex = canvas.width *item['ex']*map_scale + map_pan[0]
  var ey = canvas.height*item['ey']*map_scale + map_pan[1]
  
  ctx.lineWidth = 3.0*Math.sqrt(map_scale)
  ctx.strokeStyle = calcMapObjectColor(item)
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()
}


function draw_player(canvas, ctx, item, dt) {
  var x = item['x']
  var y = item['y']
  var dir = $V([item['dx'], item['dy']])

  if (lastPlayerPos) {
	var x0 = lastPlayerPos['x']
	var y0 = lastPlayerPos['y']
	if (Math.abs(x0 - x) < 0.01)
	  x = approach(x0, x, dt, 0.4)
	if (Math.abs(y0 - y) < 0.01)
	  y = approach(y0, y, dt, 0.4)

	var dir0 = $V(lastPlayerPos['dir'])
	var angle = dir.signedAngle2DFrom(dir0)

	if (angle > -Math.PI*0.25 && angle < Math.PI*0.25) {
	  angle = approach(0.0, angle, dt, 0.4)
	  dir = dir0.rotate(angle, [0,0])
	}
  }

  ctx.fillStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#333';
  ctx.beginPath()
  var w = 7.0
  var l = 25.0
  var dx = dir.at(0)
  var dy = dir.at(1)
  var sx = x*canvas.width*map_scale + map_pan[0]
  var sy = y*canvas.height*map_scale + map_pan[1]

  // center arrow
  sx -= l*0.5*dx
  sy -= l*0.5*dy

  ctx.moveTo(sx-w*dy, sy+w*dx)
  ctx.lineTo(sx+w*dy, sy-w*dx)
  ctx.lineTo(sx+l*dx, sy+l*dy)
  //console.log('dx = ' + dx + ', dy = ' + dy)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  return {'x': x, 'y': y, 'dir': dir.elements}
}


function draw_map_object(canvas, ctx, item, rotate) {
  var x = canvas.width*item['x']
  var y = canvas.height*item['y']

  ctx.fillStyle = calcMapObjectColor(item)
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#000';

  ctx.font = 'bold 18pt Icons'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  var s = null
  if (item['icon'] == 'Airdefence')
	s = '4'
  else if (item['icon'] == 'Structure')
	s = '5'        
  else if (item['icon'] == 'waypoint')
	s = '6'
  else if (item['icon'] == 'capture_zone')
	s = '7'        
  else if (item['icon'] == 'bombing_point')
	s = '8'
  else if (item['icon'] == 'defending_point')
	s = '9'
  else if (item['icon'] == 'respawn_base_tank')
	s = '0'
  else if (item['icon'] == 'respawn_base_fighter')
	s = '.'
  else if (item['icon'] == 'respawn_base_bomber')
	s = ':'
  else
	s = item['icon'][0]

  var sx = x*map_scale + map_pan[0]
  var sy = y*map_scale + map_pan[1]
  if (rotate)
  {
	ctx.save()
	ctx.translate(sx, sy)
	var heading = Math.atan2(item.dx, -item.dy)
	ctx.rotate(heading)
	ctx.translate(-sx, -sy)
	ctx.fillText(s, sx, sy)
	ctx.strokeText(s, sx, sy)
	ctx.restore()
  }
  else
  {
	ctx.fillText(s, sx, sy)
	ctx.strokeText(s, sx, sy)      
  }
}

function redraw_map(dt) {
  var canvas = document.getElementById('map-canvas')
  var ctx = canvas.getContext('2d')
  //ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.setTransform(map_scale, 0, 0, map_scale, map_pan[0], map_pan[1])
  if (map_image.complete && map_image.naturalWidth) {
	ctx.drawImage(map_image, 0, 0, canvas.width, canvas.height)
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  drawMapGridScaled(canvas)

  var player = null
  if ($.isArray(map_objects)) {
	for (var i=0; i<map_objects.length; ++i) {
	  var item = map_objects[i];
	  if (item['type'] == 'airfield') {
		draw_airfield(canvas, ctx, item)
	  } else {
		if (item['icon'] == 'Player') {
		  player = item;
		} else {
		  var rotate = (item['type'] == 'respawn_base_fighter') || (item['type'] == 'respawn_base_bomber')
		  draw_map_object(canvas, ctx, item, rotate)
		}
	  }
	}
  }

  if (player) {  
	lastPlayerPos = draw_player(canvas, ctx, player, dt)
  } else {
	lastPlayerPos = null
  }
}


function update_timers() {
  var t = new Date().getTime()
  var dt = 0.0
  if (lastT) {
	dt = (t-lastT)*0.001
	blinkNormalT += dt
	blinkHeavyT += dt
	var periodNormal = 2.0
	var periodHeavy = 1.2
	if (blinkNormalT > periodNormal)
	  blinkNormalT -= periodNormal*Math.floor(blinkNormalT / periodNormal)
	if (blinkHeavyT > periodHeavy)
	  blinkHeavyT -= periodHeavy*Math.floor(blinkHeavyT / periodHeavy)
	blinkNormalVal = Math.exp(-Math.pow(5*blinkNormalT-2, 4))
	blinkHeavyVal = Math.exp(-Math.pow(5*blinkHeavyT-2, 4))
  }
  lastT = t
  return dt
}

function add_to_chat(root, rec) {
  let messageType = "chat-msg-";
  
  if (rec.msg === "Chat Spamming") {
    // don't bother showing this
    return;
  }
  else if (rec.sender === "") {
    messageType = "hud-msg-"; 
  }
  
  // if we've already added this message...
  // just exit
  var existingEl = document.getElementById(messageType+rec.id);
  if (existingEl) {
    return;
  }
  
  var el = $(document.createElement('div'))
  el.attr("id",messageType+rec.id);
  el.addClass('chat-line')
  if (rec.sender) {
	var s = ''
	if (rec['mode']) {
	  s += '['+rec['mode']+'] '
  }
	s += rec.sender + ': ' + rec.msg
	el.text(s)
	if (rec['enemy'])  
	  el.addClass('msg-type-enemy')
  } else {
    el.text(rec.msg)
    el.addClass('msg-type-system')
  }
  root.append(el)
}

function update_hud_msg(data) {
  if (!data)
	return

  var msgEvt = data['events']
  var msgDmg = data['damage']
  var types = [[msgEvt, '#hud-evt-msg-root #textlines'], [msgDmg, '#hud-dmg-msg-root #textlines']]
  for (var tp=0; tp<types.length; ++tp) {
	var msg = types[tp][0]
	var root = $(types[tp][1])
	for (var i=0; i<msg.length; ++i) {
	  add_to_chat(root, msg[i])
	}
	root.get(0).scrollTop = root.get(0).scrollHeight
  }

  if (msgEvt.length)
	lastEvtMsgId = msgEvt[msgEvt.length-1].id
  if (msgDmg.length)
	lastDmgMsgId = msgDmg[msgDmg.length-1].id
}


function updateFast() {
  var dt = update_timers()
  if (!isDraggingMap && !isTransformingMap)
	redraw_map(dt)
}


function normalizeText(text) {
  return text.replace('<', '&lt;').replace('>', '&gt;');
}


function localize_static() {
  var elems = $('.loc')
  var len = elems.length
  for (var i=0; i<len; ++i) {
	var e = $(elems[i])
	var key = e.text()
	if (key in loc_tbl)
	  e.text(loc_tbl[key])
  }
}


function page_log(data) {
  var el = $('<div></div>')
  el.text(data)
  $(document.body).append(el)
}

pos_save_elem_ids = {
  '#map-root': ['left', 'top'],
  '#map-canvas': ['width', 'height'],
  '#mission-objectives': ['left', 'top', 'width'],
  '#game-chat-root': ['width', 'height', 'left', 'top'],
  '#hud-evt-msg-root': ['width', 'height', 'left', 'top'],
  '#hud-dmg-msg-root': ['width', 'height', 'left', 'top'],
  '#indicators-root': ['left', 'top', 'width', 'height'],
  '#state-root': ['left', 'top', 'width', 'height'],
  '#energy-data': ['left', 'top', 'width', 'height']
}

function get_pos_prop(elem, field) {
  if (field == 'width' || field == 'height')
	return elem[field]()
  else
	return elem.offset()[field]
}

function set_pos_prop(elem, field, val) {
  if (field == 'width' || field == 'height')
	return elem[field](val)
  else {
	var offs = elem.offset()
	offs[field] = val
	elem.offset(offs)
  }
}

function load_positions() {
  for (var id in pos_save_elem_ids) {
    var cookieVal = Cookies.get(id)
    if (cookieVal) {
      var elem = $(id)
      var values = cookieVal.split('|')
      for (var vi in values) {
        var kv = values[vi].split(':');
        if (kv.length==2) {
          set_pos_prop(elem, kv[0], kv[1])
        }
      }
    }
  }

  var canvas = $('#map-canvas')
  canvas.get(0).width  = canvas.width()
  canvas.get(0).height = canvas.height()
}


function save_positions() {
  for (var id in pos_save_elem_ids) {
	var elem = $(id)
	var fields = pos_save_elem_ids[id]
	var cookieVal = ''
	for (var idx in fields) {
	  if (cookieVal) cookieVal+='|';
	  cookieVal += fields[idx]+':'+get_pos_prop(elem, fields[idx])
	}
	if (cookieVal)
	  Cookies.set(id, cookieVal, {expires:cookieLifeTime})
  }
}


function save_indicators_order(event, ui) {
  var lists = [$('#indicators0 li'), $('#indicators1 li')]
  var order = [[],[]]
  for (var iList=0; iList<2; ++iList) {
	for (var iItem=0, nItems=lists[iList].length; iItem<nItems; ++iItem) {
	  order[iList].push(lists[iList][iItem].id.slice(4))
	}
  }
  var val = order[0].join('|') + ':' + order[1].join('|')
  Cookies.set('indicators', val, {expires:cookieLifeTime})
}

function save_state_order(event, ui) {
  var lists = [$('#state0 li'), $('#state1 li')]
  var order = [[],[]]
  for (var iList=0; iList<2; ++iList) {
	for (var iItem=0, nItems=lists[iList].length; iItem<nItems; ++iItem) {
	  order[iList].push(lists[iList][iItem].id.slice(4))
	}
  }
  var val = order[0].join('|') + ':' + order[1].join('|')
  Cookies.set('state', val, {expires:cookieLifeTime})
}

function fill_indicators_list() {
  var addElem = function(root, id) {
	var elem = $('<li id="ind-'+id+'" style="display:none;"></li>')
	//var elem = $('<li id="ind-'+id+'">'+id+'</li>')
	root.append(elem)
  }

  var fullIndIdList = indicator_columns[0].concat(indicator_columns[1])

  var savedVal = Cookies.get('indicators')
  var order = [[], []]
  if (savedVal) {
	var s = savedVal.split(':')
	order = [s[0].split('|'), s[1].split('|')]
	for (var iList=0; iList<2; ++iList) {
	  var root = $('#indicators'+iList)
	  for (var iItem=0, nItems=s[iList].length; iItem<nItems; ++iItem) {
		var id = order[iList][iItem]
		if (fullIndIdList.indexOf(id) >= 0) {
		  addElem(root, id)
		}
	  }
	}          
  }

  var savedIdsListFull = order[0].concat(order[1])

  for (var iList=0; iList<2; ++iList) {
	var list = indicator_columns[iList]
	var root = $('#indicators'+iList)
	for (var iItem=0; iItem<list.length; ++iItem) {
	  if (savedIdsListFull.indexOf(list[iItem]) < 0) {
		addElem(root, list[iItem])
	  }
	}
  }
}

function fill_state_list() {
 var addElem = function(root, id) {
	var elem = $('<li id="stt-'+id+'" style="display:none;"></li>')
	//var elem = $('<li id="stt-'+id+'">'+id+'</li>')
	root.append(elem)
  }

  var fullStateIdList = state_columns[0].concat(state_columns[1])

  var savedVal = Cookies.get('state')
  var order = [[], []]
  if (savedVal) {
	var s = savedVal.split(':')
	order = [s[0].split('|'), s[1].split('|')]
	for (var iList=0; iList<2; ++iList) {
	  var root = $('#state'+iList)
	  for (var iItem=0, nItems=s[iList].length; iItem<nItems; ++iItem) {
		var id = order[iList][iItem]
		if (fullStateIdList.indexOf(id) >= 0) {
		  addElem(root, id)
		}
	  }
	}          
  }

  var savedStateListFull = order[0].concat(order[1])

  for (var iList=0; iList<2; ++iList) {
	var list = state_columns[iList]
	var root = $('#state'+iList)
	for (var iItem=0; iItem<list.length; ++iItem) {
	  if (savedStateListFull.indexOf(list[iItem]) < 0) {
		addElem(root, list[iItem])
	  }
	}
  }
}

function init() {
  localize_static()

  var canvasEl = document.getElementById('map-canvas')
  
  addWheelHandler(canvasEl, mapOnWheel)
  canvasEl.onselectstart = function() {return false} //== Chrome fix
  //$("#map-canvas").mousedown(mapOnMouseDown)

  //Hammer.plugins.showTouches();
  //Hammer.plugins.fakeMultitouch();

  var ht = Hammer(canvasEl, hammer_opt)
  var events = ['drag', 'dragstart', 'dragend', 'transform', 'transformstart', 'transformend']
  for (var ei in events) {
	ht.on(events[ei], on_touch_event)
  }

  load_positions()
  fill_indicators_list()
  fill_state_list()

  var interactive = ['#game-chat-root', '#hud-evt-msg-root', '#hud-dmg-msg-root', '#energy-data']
  for (var i in interactive) {
    var el = $(interactive[i]);
    el.draggable({handle:'#draghandle', stop:save_positions})
      .resizable({stop:save_positions});
  }
  $('#mission-objectives').draggable({handle:'#draghandle', stop:save_positions}).resizable({handles: 'e', stop:save_positions})
  $('#indicators-root').draggable({handle:'#draghandle', stop:save_positions}).resizable({stop:save_positions})
  $('#state-root').draggable({handle:'#draghandle', stop:save_positions}).resizable({stop:save_positions})

  $('#map-root').draggable({handle:'#draghandle', stop: save_positions})
  $('#map-canvas').resizable({
	aspectRatio: 1,
	minWidth: 256,
	minHeight: 256,
	stop: function(event, ui) {
	  var canvas = ui.element.find('canvas').get(0)
	  var factor = ui.size.width / canvas.width
	  canvas.width = ui.size.width
	  canvas.height = ui.size.height
	  map_pan[0] *= factor
	  map_pan[1] *= factor
	  redraw_map()
	  save_positions()
	}
  })

  $("#indicators0, #indicators1").sortable(
	{connectWith: ".connectedIndicators", stop:save_indicators_order}
  ).disableSelection()
  
  $("#state0, #state1").sortable(
	{connectWith: ".connectedState", stop:save_state_order}
  ).disableSelection()      
}

window.onload = init;

// from utils.js

function lerp(a, b, k) {
  return a*(1.0-k) + b*k
}


function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(x, hi))
}


function approach(from, to, dt, viscosity) {
  if (viscosity < 1e-9)
    return to;
  else
    return from + (1.0 - Math.exp(-dt / viscosity)) * (to - from);
}


function rgb_to_hex(r, g, b) {
  var rr = r.toString(16)
  var gg = g.toString(16)
  var bb = b.toString(16)
  var str = "#" + 
    (rr.length == 1 ? "0" + rr : rr) + 
    (gg.length == 1 ? "0" + gg : gg) + 
    (bb.length == 1 ? "0" + bb : bb);
  return str
}

// IE support
if (!Array.indexOf) {
  Array.prototype.indexOf = function(obj) {
    for (var i=0; i<this.length; i++) {
      if (this[i]==obj)
         return i;
    }
    return -1;
  }
}
